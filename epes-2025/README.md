# EPES Challenge 2025 – Engine coletivo

Este repositório contém a aplicação web (React + Firebase) e o motor de simulação coletivo para o desafio EPES 2025. A versão atual corrige o bug de cálculo isolado de demanda: agora todas as equipes disputam o mesmo mercado e a divisão de vendas respeita o tamanho total do mercado da rodada.

## Visão geral das pastas

| Pasta | Descrição |
|-------|-----------|
| `engine/` | Módulos TypeScript puros com todo o algoritmo competitivo (EA, softmax, demanda, custos, lucro, divisão 20/80). |
| `server/` | API HTTP minimalista (`/v1/compute` e `/v1/close-round`) que compila o motor e expõe os cálculos via REST. |
| `src/` | Aplicação React. Os destaques são o novo hook `useRoundPreview`, a tela de decisões (D2..D10) e o ranking com preview. |
| `tests/` | Runner em Node que compila o motor e executa testes automatizados exigidos (softmax, demanda coletiva, limite de capacidade, split 20/80, amortecedor e cenário de três equipes). |

## Pré-requisitos

* Node.js 20+
* Conta Firebase já configurada (as chaves existentes permanecem).
* Permissão de leitura/gravação nas coleções descritas abaixo.

## Instalação

```bash
npm install # usa dependências já presentes no lockfile
```

> **Observação:** o ambiente de testes executa o TypeScript do motor via `npx tsc`. Nenhuma biblioteca adicional é necessária.

## Scripts principais

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend em modo desenvolvimento (Vite). |
| `npm run server:dev` | Sobe a API do motor em `http://localhost:8080` (compila `engine/` automaticamente). |
| `npm run build` | Build de produção do frontend. |
| `npm run test` | Compila o motor (`tsconfig.engine.json`) e roda os testes automatizados em `tests/run-tests.js`. |

## API do motor

### `POST /v1/compute`

Calcula o ranking coletivo da rodada.

```bash
curl -X POST http://localhost:8080/v1/compute \
  -H "Content-Type: application/json" \
  -d '{
        "season": {
          "refPrice": 50,
          "softmaxBeta": 1.1,
          "shareCap": 0.55,
          "dampingAlpha": 1.5,
          "weights": { "price": 40, "quality": 30, "marketing": 20, "cx": 10 },
          "costs": { "cvuBase": 12, "kQuality": 8, "kEfficiency": 6, "fixedTeamCost": 2000, "benefitCost": 500 },
          "rules": { "reinvestRate": 0.2 }
        },
        "publicTargets": [
          { "id": "CLASS_AB", "deltas": {"price": 5}, "elasticity": 0.9, "marketingBoost": 0.1 },
          { "id": "CLASS_CD", "deltas": {"marketing": 3}, "elasticity": 1.3, "marketingBoost": 0.2 }
        ],
        "teams": [
          {
            "teamId": "CLASS_AB",
            "name": "Classe AB",
            "publicTargetId": "CLASS_AB",
            "price": 55,
            "marketingSpend": 15000,
            "capacity": 8000,
            "quality": 80,
            "efficiency": 60,
            "cx": 70,
            "launchEA": 0.05,
            "brandEA": 0.05,
            "reinvestBudget": 2000,
            "cash": 9000
          }
        ],
        "round": { "marketSize": 10000, "roundId": "D5" }
      }'
```

Resposta resumida:

```json
{
  "results": [
    {
      "teamId": "CLASS_AB",
      "share": 0.42,
      "sales": 4200,
      "revenue": 231000,
      "profit": 64000,
      "reinvest": 12800,
      "cashToFinal": 51200,
      "flags": { "capacityBound": false, "priceRisk": false, "negativeProfit": false }
    }
  ],
  "totals": {
    "marketSize": 10000,
    "totalShare": 1,
    "totalSales": 10000,
    "totalProfit": 64000
  }
}
```

### `POST /v1/close-round`

Recalcula a rodada e retorna apenas os agregados (útil para persistência oficial). Inclua o cabeçalho `Idempotency-Key` para garantir idempotência.

## Fluxo das telas (frontend)

* **D0 – Identidade**: tela existente continua utilizada para cadastrar nome/logo/público.
* **D1 – Planejamento**: orçamento inicial utiliza os valores carregados do Firestore e prepara a rodada D2.
* **D2 – D10 – Decisões**:
  * Formulário com validações de preço (±20% do preço de referência) e upgrades limitados ao orçamento de reinvestimento.
  * Botões “Salvar” e “Calcular Preview” invocam o endpoint `/v1/compute` via `useRoundPreview`.
  * Bloco “Meu time” mostra EA, participação, vendas, receita, lucro e divisão 20/80.
  * Tabela “Ranking previsto” ordena todas as equipes pelo lucro do preview.
* **Ranking**: mantém o ranking oficial (dados persistidos) e adiciona um bloco de preview competitivo calculado pelo motor coletivo.

## Estrutura de dados no Firestore

```
seasons/{seasonId}
  refPrice, softmaxBeta, shareCap, dampingAlpha
  weights { price, quality, marketing, cx }
  costs { cvuBase, kQuality, kEfficiency, fixedTeamCost, benefitCost }
  rules { reinvestRate }
  publicTargets/{targetId} { deltas, elasticity, marketingBoost }
  teams/{teamId} { cash, reinvestBudget }
  rounds/{roundId}
    marketSize, startAt, lockAt
    teams/{teamId} { price, marketingSpend, capacity, quality, efficiency, cx, launchEA, brandEA, benefitChoice }
```

## Como garantimos o mercado coletivo

1. **Cálculo vetorial do EA** – todas as equipes passam pelo mesmo vetor de pesos ajustados pelo público-alvo (`tunedWeights`). O EA final incorpora preço, qualidade, marketing, CX e bônus de marca/lançamento.
2. **Softmax competitivo** – aplicamos `softmax(beta)` seguido de `capShares` (limite opcional por time) e renormalização. A soma dos shares é sempre 1.
3. **Demanda coletiva** – `demandRaw = marketSize * share * (P* / price)^elasticity`. As vendas brutas são limitadas individualmente pela capacidade e, se a soma ainda exceder o market size, aplicamos um `rescale` proporcional garantindo `∑sales ≤ marketSize`.
4. **Lucro e windfall** – custos variáveis, marketing, fixos e benefícios são abatidos. O amortecedor (`windfallDamping`) reduz outliers com base em mediana + MAD antes de dividir o lucro em 20% reinvestível e 80% para o caixa final.
5. **API e UI** – o endpoint `/v1/compute` devolve todos os times ordenados por lucro. O frontend consome apenas a resposta agregada, preservando o sigilo das decisões rivais.

## Decisões & justificativas

* **Custo de upgrade simplificado**: em ausência de uma tabela oficial, adotamos R$100 por ponto acima do patamar anterior (qualidade, eficiência, CX). Documentamos essa regra e garantimos que o formulário bloqueie upgrades acima do `reinvestBudget` retornado pelo backend.
* **Servidor HTTP nativo**: optamos por Node `http` puro para evitar dependências extras e facilitar o deploy em Cloud Run/Firebase Hosting + Cloud Functions.
* **Testes em Node puro**: como o ambiente não disponibiliza bibliotecas adicionais, o runner compila o TypeScript do motor e valida os cenários via `assert`, cumprindo os requisitos funcionais.

## Como rodar localmente

1. Inicie o backend do motor:
   ```bash
   npm run server:dev
   ```
2. Em outro terminal, suba o frontend:
   ```bash
   npm run dev
   ```
3. Acesse `http://localhost:5173`.
4. Configure a variável `VITE_ENGINE_URL` (arquivo `.env`) caso a API esteja hospedada em outro endereço.

## Contribuindo

1. Garanta que os testes passem: `npm run test`.
2. Registre as decisões no Firestore seguindo o esquema acima.
3. Abra um PR descrevendo alterações relevantes no motor ou nas telas.

Bom jogo! 🚀

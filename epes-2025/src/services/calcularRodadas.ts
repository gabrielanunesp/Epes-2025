export interface ResultadoRodada {
  ea: number;
  demanda: number;          // demanda atribuída pelo share (antes de capacidade)
  vendas: number;           // vendas efetivas (após limite de capacidade)
  receita: number;
  custo: number;
  lucro: number;
  reinvestimento: number;
  caixaFinal: number;
  cvu: number;
  backlog: boolean;         // true quando demanda > vendas (faltou capacidade)
  satisfacao: number;
  evento?: string;
  share?: number;           // % para UI (compatível)
  shareFraction?: number;   // 0..1
}

// ===== NOVO: tipos para cálculo coletivo =====
export interface EquipeInput {
  id: string;                 // identificador do time
  preco: number;
  qualidade: number;          // 0..100
  marketingBonus: number;     // ex.: 0..100 (seu padrão)
  equipeBonus: number;        // 0..100
  beneficioBonus: number;     // 0|10|15|20 – cupom/brinde/frete
  capacidade: number;         // limite de vendas
  publicoAlvo: string;        // "Jovens (15–24 anos)", etc.
  caixaAcumulado: number;     // saldo anterior (para somar 80%)
}

export interface ParametrosGlobais {
  refPrice: number;           // P*
  marketSize: number;         // tamanho total do mercado
  beta: number;               // temperatura do softmax
  shareCap?: number;          // teto de share por time (opcional)
  fixedTeamCost: number;      // custo fixo por rodada
  ea50: number;               // ponto médio da sigmoide (se usado)
  eaK: number;                // inclinação da sigmoide (se usado)
  reinvestRate: number;       // 0.20
}

export interface ResultadoColetivoPorTime extends ResultadoRodada {
  teamId: string;
  unitCost: number;
}

export interface ResultadoColetivo {
  resultados: ResultadoColetivoPorTime[]; // um por equipe
  ranking: { teamId: string; lucro: number }[]; // ordenado desc
  somaSales: number;
  somaShares: number; // ~1
}

// ================= Helpers =================
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function calcularCVU(qualidade: number, eficiencia: number): number {
  const base = 20;
  const alpha = 0.2;
  const beta = 0.1;
  const cvu = base + alpha * qualidade - beta * eficiencia;
  return Math.max(0, parseFloat(cvu.toFixed(2)));
}

const priceScore = (p: number, refPrice: number) => {
  const denom = 0.5 * refPrice || 1;
  return clamp(1 - (p - refPrice) / denom, 0, 1);
};

const marketingScoreFromBonus = (bonusPct: number, boost: number) => {
  const spend = Math.max(0, bonusPct) * 1000; // compatível com seu custo
  const raw = Math.log(1 + spend) / 10;       // retorno decrescente
  return clamp((1 + boost) * raw, 0, 1);
};

const softmax = (arr: number[], beta: number) => {
  const scaled = arr.map((x) => x * beta);
  const m = Math.max(...scaled);
  const exps = scaled.map((x) => Math.exp(x - m));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
};

const capShares = (shares: number[], cap?: number) => {
  if (cap == null) return shares;
  const capped = shares.map((x) => Math.min(x, cap));
  const sum = capped.reduce((a, b) => a + b, 0) || 1;
  return capped.map((x) => x / sum);
};

// ===== Mapas (mantidos do seu código) =====
const qualidadeMultiplicador: Record<string, number> = {
  "Jovens (15–24 anos)": 0.8,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.2,
  "Classe A/B": 1.25,
  "Classe C/D": 0.8,
};

const marketingMultiplicador: Record<string, number> = {
  "Jovens (15–24 anos)": 1.3,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.2,
  "Classe A/B": 1.1,
  "Classe C/D": 1.15,
};

const equipeMultiplicador: Record<string, number> = {
  "Jovens (15–24 anos)": 0.9,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.3,
  "Classe A/B": 1.1,
  "Classe C/D": 0.9,
};

const elasticidadePreco: Record<string, number> = {
  "Jovens (15–24 anos)": 1.2,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 0.8,
  "Classe A/B": 0.9,
  "Classe C/D": 1.5,
};

const beneficioBonusExtra: Record<string, number> = {
  "Cupom|Classe C/D": 5,
  "Brinde|Jovens (15–24 anos)": 5,
  "Frete grátis|Adultos (25–40 anos)": 5,
  "Frete grátis|Sêniores (40+)": 5,
};

// ========== CÁLCULO COLETIVO ==========
export function calcularRodadaColetiva(
  equipes: EquipeInput[],
  params: Partial<ParametrosGlobais> = {}
): ResultadoColetivo {
  const {
    refPrice = 100,
    marketSize = 2000,
    beta = 3.0,
    shareCap,
    fixedTeamCost = 5000,
    ea50 = 100,
    eaK = 30,
    reinvestRate = 0.2,
    subRate = 0.5, // fração da demanda não atendida que migra para concorrentes
  } = params as any;

  if (!equipes || equipes.length === 0) {
    return { resultados: [], ranking: [], somaSales: 0, somaShares: 0 };
  }

  // 1) EA por equipe (linear, com públicos)
  const eas = equipes.map((t) => {
    const publico = (t.publicoAlvo || "").trim();
    const pScore = priceScore(t.preco > 0 ? t.preco : refPrice, refPrice);
    const mScore = marketingScoreFromBonus(
      t.marketingBonus ?? 0,
      (marketingMultiplicador[publico] ?? 1) - 1
    );

    const beneficioTipo =
      t.beneficioBonus === 10 ? "Cupom" :
      t.beneficioBonus === 15 ? "Brinde" :
      t.beneficioBonus === 20 ? "Frete grátis" : "Nenhum";
    const bonusExtra = beneficioBonusExtra[`${beneficioTipo}|${publico}`] ?? 0;
    const beneficio = (t.beneficioBonus ?? 0) + bonusExtra;

    const eaLinear =
      100 * pScore +
      (t.qualidade ?? 0) * (qualidadeMultiplicador[publico] ?? 1) +
      100 * mScore +
      (t.equipeBonus ?? 0) * (equipeMultiplicador[publico] ?? 1) +
      beneficio;

    // opcional: apertar/afrouxar com sigmoide ao redor de ea50
    const prop = 1 / (1 + Math.exp(-(eaLinear - ea50) / eaK));
    // Incorporar elasticidade de preço no score antes do softmax
    const eps = elasticidadePreco[publico] ?? 1.0;
    const price = t.preco > 0 ? t.preco : refPrice;
    const priceMult = Math.pow(refPrice / price, eps);
    const eaPriceAdjusted = eaLinear * priceMult;
    return { eaLinear: eaPriceAdjusted, prop };
  });

    // 2) Softmax sobre EA normalizado com ganho + slight jitter (quebra empates)
    const eaVals = eas.map((e) => e.eaLinear);
    const minEA = Math.min(...eaVals);
    const maxEA = Math.max(...eaVals);

    // normaliza 0..1; se todos iguais, evita divisão por zero
    let normEA: number[];
    if (maxEA - minEA < 1e-6) {
      normEA = eaVals.map(() => 1);
    } else {
      normEA = eaVals.map((x) => (x - minEA) / (maxEA - minEA));
    }

    // 🔎 Aumenta contraste (gamma) e quebra empates com um jitter estável por índice
    const gamma = 1.6; // ↑ se precisar mais contraste
    normEA = normEA.map((x, i) => Math.pow(x + 1e-6 * (i + 1), gamma));

    // 💥 Beta mais agressivo (suba se necessário)
    const betaEff = typeof beta === "number" ? beta : 3.0;
    // ⚠️ SE VOCÊ PASSA shareCap em algum lugar, temporariamente desative para testar: deixe `undefined` ou >0.8

    let shares = softmax(normEA, betaEff);
    shares = capShares(shares, shareCap);
    const somaShares = shares.reduce((a, b) => a + b, 0);

    console.log("[DEBUG][coletivo] EA:", eaVals);
    console.log("[DEBUG][coletivo] EA_norm+gain:", normEA);
    console.log("[DEBUG][coletivo] betaEff:", betaEff, "shareCap:", shareCap);
    console.log("[DEBUG][coletivo] shares:", shares, "somaShares:", somaShares);

  // 4) Demanda e vendas (ajustado com redistribuição proporcional)
  let demandRaw = equipes.map((t, i) => marketSize * shares[i]);

  // Aplicar limite de capacidade inicial
  let sales = equipes.map((t, i) => Math.min(demandRaw[i], Math.max(0, t.capacidade || 0)));

  // Declarar uma vez e atualizar depois da redistribuição
  let somaSales = sales.reduce((a, b) => a + b, 0);
  console.log("[DEBUG][coletivo] marketSize:", marketSize);
  console.log("[DEBUG][coletivo] demandRaw:", demandRaw);
  console.log("[DEBUG][coletivo] capacidade:", equipes.map(t => t.capacidade || 0));
  console.log("[DEBUG][coletivo] sales.beforeRedistrib:", sales, "somaSales:", somaSales);

// Verificar se há mercado não atendido e redistribuir parcialmente (substituibilidade)
let totalSales = sales.reduce((a, b) => a + b, 0);
let sobra = marketSize - totalSales;

// quanto de fato será realocado para concorrentes (0..sobra)
const realocar = sobra > 0 ? sobra * subRate : 0;

if (realocar > 0.01) {
  // candidatos que ainda têm capacidade
  const candidatos = equipes
    .map((t, i) => ({
      i,
      cap: Math.max(0, t.capacidade || 0),
      flex: Math.max(0, (t.capacidade || 0) - sales[i]),
      weight: Math.max(1e-6, shares[i]), // pondera por share (EA)
    }))
    .filter((c) => c.flex > 0);

  const somaPeso = candidatos.reduce((a, c) => a + c.weight, 0);
  if (somaPeso > 0) {
    // não pode realocar mais que a flex total
    const flexTotal = candidatos.reduce((a, c) => a + c.flex, 0);
    const reallocate = Math.min(realocar, flexTotal);

    for (const c of candidatos) {
      const add = (c.weight / somaPeso) * reallocate;
      sales[c.i] = Math.min(c.cap, sales[c.i] + add);
    }
  }
}

// Recalcular após redistribuição
somaSales = sales.reduce((a, b) => a + b, 0);
console.log("[DEBUG][coletivo] sobra:", sobra, "subRate:", subRate, "realocar:", realocar);
console.log("[DEBUG][coletivo] sales.afterRedistrib:", sales, "somaSales:", somaSales);

  // 5) Custos e resultados
  const resultados: ResultadoColetivoPorTime[] = equipes.map((t, i) => {
    const publico = (t.publicoAlvo || "").trim();
    const eficiencia = Math.min(100, 50 + (t.equipeBonus ?? 0)); // proxy simples
    const unit = calcularCVU(t.qualidade ?? 0, eficiencia);

    const receita = sales[i] * (t.preco > 0 ? t.preco : refPrice);
    const custoVariavel = sales[i] * unit;
    const custoMarketing = (t.marketingBonus ?? 0) * 1000;
    const custoEquipe = (t.equipeBonus ?? 0) * 1000;
    const beneficioTipo =
      t.beneficioBonus === 10 ? "Cupom" :
      t.beneficioBonus === 15 ? "Brinde" :
      t.beneficioBonus === 20 ? "Frete grátis" : "Nenhum";
    const bonusExtra = beneficioBonusExtra[`${beneficioTipo}|${publico}`] ?? 0;
    const custoBeneficio = ( (t.beneficioBonus ?? 0) + bonusExtra ) * 1000;

    const custoTotal = custoVariavel + custoMarketing + custoEquipe + custoBeneficio + fixedTeamCost;
    const lucro = receita - custoTotal;

    const reinvest = lucro > 0 ? lucro * reinvestRate : 0;
    const cashToFinal = lucro > 0 ? lucro * (1 - reinvestRate) : 0;

    const eaLinear = eas[i].eaLinear;
    const shareFraction = demandRaw[i] / marketSize; // para UI

    const resultado: ResultadoColetivoPorTime = {
      teamId: t.id,
      ea: parseFloat(eaLinear.toFixed(2)),
      demanda: Math.round(demandRaw[i]),
      vendas: Math.round(sales[i]),
      receita: parseFloat(receita.toFixed(2)),
      custo: parseFloat(custoTotal.toFixed(2)),
      lucro: parseFloat(lucro.toFixed(2)),
      reinvestimento: parseFloat(reinvest.toFixed(2)),
      caixaFinal: parseFloat((t.caixaAcumulado + Math.max(0, cashToFinal)).toFixed(2)),
      cvu: parseFloat(unit.toFixed(2)),
      backlog: demandRaw[i] > sales[i],
      satisfacao: Math.min(100, eaLinear / 2),
      evento: demandRaw[i] > sales[i] ? "PENALIDADE_NEXT" : undefined,
      share: parseFloat((clamp(shareFraction, 0, 1) * 100).toFixed(2)),
      shareFraction: clamp(shareFraction, 0, 1),
      unitCost: parseFloat(unit.toFixed(2)),
    };

    return resultado;
  });

  // 6) Ranking por lucro
  const ranking = resultados
    .map((r) => ({ teamId: (r as any).teamId as string, lucro: r.lucro }))
    .sort((a, b) => b.lucro - a.lucro);

  return { resultados, ranking, somaSales, somaShares };
}

// ====== PREVIEW para uma equipe (ainda coletivo) ======
export function calcularRodadaPreview(
  todasEquipes: EquipeInput[],
  timeId: string,
  params?: Partial<ParametrosGlobais>
): ResultadoColetivoPorTime | null {
  const full = calcularRodadaColetiva(todasEquipes, params);
  return full.resultados.find((r) => (r as any).teamId === timeId) || null;
}

// ====== DEPRECATED: cálculo individual (proíbo uso na produção) ======
export function calcularRodada(_: any): ResultadoRodada {
  throw new Error(
    "[calcularRodada] Removido o cálculo individual. Use calcularRodadaColetiva(equipes, params) ou calcularRodadaPreview(todasEquipes, timeId, params)."
  );
}

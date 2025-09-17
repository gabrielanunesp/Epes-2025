import React from 'react';

interface Props {
  producao: number;
  producaoCost: number;
  marketing: string[];
  marketingCost: number;
  investimento: string[];
  investimentoCost: number;
  pd: string[];
  pdCost: number;
  precoEscolhido: number;
  restante: number;
  reinvestimentoDisponivel: number;
  caixaAcumulado: number;
  ea?: number;
  caixaFinal?: number;
  cvu?: number;
  backlog?: boolean;
}

export default function Summary({
  producao,
  producaoCost,
  marketing,
  marketingCost,
  investimento,
  investimentoCost,
  pd,
  pdCost,
  precoEscolhido,
  restante,
  reinvestimentoDisponivel,
  caixaAcumulado,
  ea,
  caixaFinal,
  cvu,
  backlog,
}: Props) {
  return (
    <div className="summary">
      <h3>📋 Resumo da Decisão</h3>

      <p><strong>Produção:</strong> {producao}% ({producaoCost} pts)</p>
      <p><strong>Marketing:</strong> {marketing.length > 0 ? marketing.join(', ') : 'Nenhum'} ({marketingCost} pts)</p>
      <p><strong>Investimentos:</strong> {investimento.length > 0 ? investimento.join(', ') : 'Nenhum'} ({investimentoCost} pts)</p>
      <p><strong>P&D:</strong> {pd.length > 0 ? pd.join(', ') : 'Nenhum'} ({pdCost} pts)</p>
      <p><strong>Preço escolhido:</strong> R$ {precoEscolhido.toFixed(2)}</p>

      {cvu !== undefined && (
        <p>
          <strong>CVU calculado:</strong>{" "}
          <span style={{ color: cvu > 60 ? 'red' : 'green' }}>
            R$ {cvu.toFixed(2)}
          </span>
        </p>
      )}

      <p><strong>Reinvestimento disponível:</strong> R$ {reinvestimentoDisponivel}</p>
      <p><strong>Caixa acumulado:</strong> R$ {caixaAcumulado}</p>

      <p>
        <strong>Créditos restantes:</strong>{" "}
        <span className={restante < 0 ? 'alert' : 'ok'}>{restante}</span>
      </p>

      {ea !== undefined && (
        <p><strong>EA estimado:</strong> {ea}</p>
      )}

      {caixaFinal !== undefined && (
        <p><strong>Caixa final projetado:</strong> R$ {caixaFinal.toFixed(2)}</p>
      )}

      {backlog && (
        <div style={{
          backgroundColor: '#ffe0e0',
          padding: '8px',
          borderRadius: '5px',
          marginTop: '10px',
          fontWeight: 'bold',
          color: '#b00000'
        }}>
          ⚠️ Atenção: sua demanda excede a capacidade de produção. Isso pode gerar penalidade de EA na próxima rodada!
        </div>
      )}
    </div>
  );
}

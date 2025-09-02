import React from 'react';

interface Props {
  producao: number;
  marketing: string[];
  investimento: string[];
  investimentoCost: number;
  pd: string[];
  restante: number;
  reinvestimentoDisponivel: number;
  caixaAcumulado: number;
}

export default function Summary({
  producao,
  marketing,
  investimento,
  investimentoCost,
  pd,
  restante,
  reinvestimentoDisponivel,
  caixaAcumulado,
}: Props) {
  return (
    <div className="summary">
      <h3>📋 Resumo da Decisão</h3>
      <p>Produção: {producao}%</p>
      <p>Marketing: {marketing.join(', ') || 'Nenhum'}</p>
      <p>Investimentos: {investimento.join(', ') || 'Nenhum'} ({investimentoCost} pts)</p>
      <p>P&D: {pd.join(', ') || 'Nenhum'}</p>
      <p>Reinvestimento disponível: <strong>{reinvestimentoDisponivel}</strong></p>
      <p>Caixa acumulado: <strong>{caixaAcumulado}</strong></p>
      <p>
        Créditos restantes:{" "}
        <strong className={restante < 0 ? 'alert' : 'ok'}>{restante}</strong>
      </p>
    </div>
  );
}

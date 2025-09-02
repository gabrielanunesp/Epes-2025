import React from 'react';

interface Props {
  recursoInicial: number;
  totalUsed: number;
  restante: number;
  isReinvestimentoExcedido: boolean;
  reinvestimentoDisponivel: number;
}

export default function CreditBox({
  recursoInicial,
  totalUsed,
  restante,
  isReinvestimentoExcedido,
  reinvestimentoDisponivel,
}: Props) {
  return (
    <div className="credit-box">
      <div className="credit-info">
        <span>Recurso Inicial: <strong>{recursoInicial}</strong></span>
        <span>Usado: <strong>{totalUsed}</strong></span>
        <span className={restante < 0 ? 'alert' : 'ok'}>
          Restante: <strong>{restante}</strong>
        </span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${restante < 0 ? 'over' : ''}`}
          style={{ width: `${Math.min((totalUsed / recursoInicial) * 100, 100)}%` }}
        />
      </div>
      {restante < 0 && <p className="alert-text">⚠️ Crédito excedido!</p>}
      {isReinvestimentoExcedido && (
        <p className="alert-text">
          ⚠️ Investimentos excedem o limite de reinvestimento ({reinvestimentoDisponivel} pts).
        </p>
      )}
    </div>
  );
}

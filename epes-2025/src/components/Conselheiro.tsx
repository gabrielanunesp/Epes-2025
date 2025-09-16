import React from 'react';
import './Conselheiro.css';

interface ConselheiroProps {
  restante: number;
  isReinvestimentoExcedido: boolean;
  rodadaAtiva: boolean;
}

export default function Conselheiro({ restante, isReinvestimentoExcedido, rodadaAtiva }: ConselheiroProps) {
  let mensagem = 'Pronto pra decidir? Estou aqui se precisar!';

  if (!rodadaAtiva) {
    mensagem = '⏳ A rodada está fechada. Aproveita pra revisar suas escolhas!';
  } else if (restante < 0) {
    mensagem = '⚠️ Opa! Você usou mais recursos do que tem. Dá uma olhadinha nisso.';
  } else if (isReinvestimentoExcedido) {
    mensagem = '🚨 Cuidado! O reinvestimento passou do limite disponível.';
  } else if (restante === 0) {
    mensagem = '✅ Tudo alocado! Tá redondinho, hein? Pode mandar ver!';
  }

  return (
    <div className="conselheiro">
      <img src="/cute-robot-isolated.png" alt="Conselheiro" />
      <div className="mensagem">{mensagem}</div>
    </div>
  );
}

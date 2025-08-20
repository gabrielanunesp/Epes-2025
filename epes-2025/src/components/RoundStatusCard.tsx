import React from 'react';
import Button from '../components/Button';

interface RoundStatusCardProps {
  currentRound: number;
  totalRounds: number;
  creditAvailable: number;
  onOpenDecisions: () => void;
}

const RoundStatusCard: React.FC<RoundStatusCardProps> = ({
  currentRound,
  totalRounds,
  creditAvailable,
  onOpenDecisions
}) => {
  return (
    <div className="card">
      <h3 className="card-title">Rodada {currentRound} de {totalRounds}</h3>
      <p className="card-desc">Crédito disponível: {creditAvailable} pontos</p>
      <Button className="btn-primary" onClick={onOpenDecisions}>
        Abrir Decisões
      </Button>
    </div>
  );
};

export default RoundStatusCard;

import React from 'react';
import Button from '../components/Button';

interface RoundStatusCardProps {
  onOpenDecisions: () => void;
}

const RoundStatusCard: React.FC<RoundStatusCardProps> = ({ onOpenDecisions }) => {
  return (
    <div className="card">
      <h3 className="card-title">Rodada do dia</h3>
      <p className="card-desc">Decisões de hoje moldam os resultados de amanhã.</p>
      <Button className="btn-primary" onClick={onOpenDecisions}>
        Abrir Decisões
      </Button>
    </div>
  );
};

export default RoundStatusCard;

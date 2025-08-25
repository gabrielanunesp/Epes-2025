import React from 'react';
import './Card.css';

interface CardProps {
  title: string;
  description: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ title, description, className, onClick }) => {
  return (
    <div
      className={`card ${className || ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <h3 className="card-title">{title}</h3>
      <div className="card-desc">{description}</div>
    </div>
  );
};

export default Card;

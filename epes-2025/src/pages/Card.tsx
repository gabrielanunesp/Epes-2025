import React from 'react';
import Button from '../components/Button';
import './Card.css';

interface CardProps {
  title: string;
  description: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, description, className }) => {
  return (
    <div className={`card ${className || ''}`}>
      <h3 className="card-title">{title}</h3>
      <div className="card-desc">{description}</div>
    </div>
  );
};

export default Card;

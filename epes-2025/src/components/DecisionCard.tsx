import React from 'react';

interface Option {
  label: string;
  cost: number;
}

interface Props {
  title: string;
  options: Option[];
  selected: string[];
  toggle: (label: string) => void;
}

export default function DecisionCard({ title, options, selected, toggle }: Props) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {options.map(opt => (
        <label key={opt.label}>
          <input
            type="checkbox"
            checked={selected.includes(opt.label)}
            onChange={() => toggle(opt.label)}
          />
          {opt.label} ({opt.cost} pts)
        </label>
      ))}
    </div>
  );
}

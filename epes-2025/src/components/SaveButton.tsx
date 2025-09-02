import React from 'react';

interface Props {
  onSave: () => void;
  disabled: boolean;
}

export default function SaveButton({ onSave, disabled }: Props) {
  return (
    <div className="save-button">
      <button onClick={onSave} disabled={disabled}>
        💾 Salvar Decisões
      </button>
    </div>
  );
}

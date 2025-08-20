import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from '../components/Button';

interface Attribute {
  name: string;
  value: number;
  max: number;
}

interface HomeProps {
  onFinish: () => void; // função chamada ao salvar
}

const Home: React.FC<HomeProps> = ({ onFinish }) => {
  const seedBalance = 100;
  const [attributes, setAttributes] = useState<Attribute[]>([
    { name: 'Quality', value: 0, max: 50 },
    { name: 'Capacity', value: 0, max: 50 },
    { name: 'CX', value: 0, max: 50 },
    { name: 'Marketing', value: 0, max: 50 },
  ]);
  const [remainingBalance, setRemainingBalance] = useState(seedBalance);

  useEffect(() => {
    const totalAllocated = attributes.reduce((sum, attr) => sum + attr.value, 0);
    setRemainingBalance(seedBalance - totalAllocated);
  }, [attributes]);

  const handleSliderChange = (index: number, newValue: number) => {
    const totalOther = attributes.reduce(
      (sum, attr, i) => i !== index ? sum + attr.value : sum,
      0
    );
    if (totalOther + newValue > seedBalance) return;

    const newAttributes = [...attributes];
    newAttributes[index].value = newValue;
    setAttributes(newAttributes);
  };

  const handleSave = () => {
    // Aqui você pode salvar no Firestore, se quiser
    console.log('Decisões salvas:', attributes);
    onFinish(); // MUDA para Dashboard
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      {attributes.map((attr, index) => (
        <Card
          key={attr.name}
          title={attr.name}
          className="home-card"
          description={
            <>
              <input
                type="range"
                min={0}
                max={attr.max}
                value={attr.value}
                onChange={(e) => handleSliderChange(index, Number(e.target.value))}
                className="w-full"
              />
              <div style={{
                height: '10px',
                background: '#ddd',
                borderRadius: '5px',
                overflow: 'hidden',
                marginTop: '5px',
                width: '100%'
              }}>
                <div style={{
                  width: `${(attr.value / attr.max) * 100}%`,
                  height: '100%',
                  background: '#10b981'
                }} />
              </div>
              <p style={{ textAlign: 'right', margin: '0.25rem 0 0 0' }}>
                {attr.value} / {attr.max}
              </p>
            </>
          }
        />
      ))}

      <div style={{ marginTop: '1.5rem' }}>
        <Button
          className="btn-primary"
          onClick={handleSave}
          disabled={remainingBalance < 0}
        >
          Salvar Decisões e Avançar
        </Button>
        {remainingBalance < 0 && <p style={{ color: 'red', marginTop: '0.5rem' }}>Saldo insuficiente!</p>}
      </div>
    </div>
  );
};

export default Home;

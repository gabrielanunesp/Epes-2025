import React, { useState, useEffect } from 'react';
import Button from '../components/Button';

interface Attribute {
  name: string;
  value: number;
  max: number;
}

interface HomeProps {
  onFinish: () => void;
}

const Home: React.FC<HomeProps> = ({ onFinish }) => {
  const seedBalance = 100;
  const [attributes, setAttributes] = useState<Attribute[]>([
    { name: 'Qualidade', value: 0, max: seedBalance },
    { name: 'Capacidade', value: 0, max: seedBalance },
    { name: 'Atendimento', value: 0, max: seedBalance },
    { name: 'Marketing', value: 0, max: seedBalance },
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
    console.log('Decisões salvas:', attributes);
    onFinish();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h2>Distribuição de Recursos (RI)</h2>

      {/* Mensagem explicativa */}
      <div style={{
        backgroundColor: '#f0f4c3',
        border: '2px solid #cddc39',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '2rem',
        color: '#827717',
        fontWeight: 500,
        lineHeight: 1.6
      }}>
        <p>
          👋 <strong>Bem-vindo à etapa de Distribuição de Recursos Iniciais!</strong><br /><br />
          Aqui você deve alocar R$ 100 entre os principais atributos da sua empresa: <em>Qualidade</em>, <em>Capacidade</em>, <em>Atendimento</em> e <em>Marketing</em>.<br /><br />
          Essa distribuição define o perfil estratégico da sua equipe e impacta diretamente o desempenho nas rodadas seguintes.<br /><br />
          ⚠️ <strong>As decisões tomadas aqui influenciam diretamente os resultados da próxima rodada.</strong> Pense estrategicamente!
        </p>
      </div>

      <p><strong>Saldo disponível:</strong> R$ {remainingBalance}</p>

      {attributes.map((attr, index) => (
        <div key={attr.name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 'bold' }}>{attr.name}</label>
          <input
            type="range"
            min={0}
            max={attr.max}
            value={attr.value}
            onChange={(e) => handleSliderChange(index, Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <p style={{ margin: '0.25rem 0 0 0' }}>
            {attr.value} — R$ {attr.value} alocados
          </p>
        </div>
      ))}

      <hr />
      <p><strong>Total alocado:</strong> R$ {seedBalance - remainingBalance} / R$ {seedBalance}</p>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <Button
          className="btn-primary"
          onClick={handleSave}
          disabled={remainingBalance < 0}
        >
          Salvar Decisões e Avançar
        </Button>

        {remainingBalance < 0 && (
          <p style={{ color: 'red', marginTop: '0.5rem' }}>
            Saldo insuficiente!
          </p>
        )}
      </div>
    </div>
  );
};

export default Home;

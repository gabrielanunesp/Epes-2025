import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { auth } from '../services/firebase';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const DecisionCard = () => {
  const navigate = useNavigate();

  const [selected, setSelected] = useState({
    investimentos: '',
    marketing: [] as string[],
    producao: 50,
    pd: ''
  });

  const [totalUsed, setTotalUsed] = useState(0);
  const creditAvailable = 100;
  const restante = creditAvailable - totalUsed;

  // Cálculo de custo baseado nas escolhas
  useEffect(() => {
    let custo = 0;

    // Exemplo de custo por produção
    if (selected.producao <= 30) custo += 10;
    else if (selected.producao <= 70) custo += 20;
    else custo += 35;

    // Custo por marketing
    const marketingCustos: Record<string, number> = {
      Eventos: 15,
      Online: 10,
      TV: 25
    };
    selected.marketing.forEach(opt => {
      custo += marketingCustos[opt] || 0;
    });

    // Custo por investimentos
    if (selected.investimentos === 'P&D') custo += 20;
    if (selected.investimentos === 'Expansão') custo += 30;

    // Custo por PD
    if (selected.pd === 'Treinamento') custo += 15;
    if (selected.pd === 'Infraestrutura') custo += 25;

    setTotalUsed(custo);
  }, [selected]);

  const handleSelect = (field: string, value: any) => {
    setSelected(prev => ({ ...prev, [field]: value }));
  };

  const toggleMarketingOption = (option: string) => {
    setSelected(prev => {
      const updated = prev.marketing.includes(option)
        ? prev.marketing.filter(o => o !== option)
        : [...prev.marketing, option];
      return { ...prev, marketing: updated };
    });
  };

  const handleSave = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || restante < 0) return;

    const docRef = doc(db, 'decisions', `${userId}_D2`);
    const payload = {
      userId,
      round: 'D2',
      ...selected,
      restante,
      totalUsed
    };

    try {
      await setDoc(docRef, payload);
      toast.success('Decisões salvas com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Erro ao salvar');
      console.error(err);
    }
  };

  return (
    <div className="decision-card">
      <h2>Tomada de Decisões</h2>

      {/* Produção com Slider */}
      <label>Produção (%):</label>
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        value={selected.producao}
        onChange={(e) => handleSelect('producao', Number(e.target.value))}
      />
      <p>{selected.producao}%</p>

      {/* Marketing com Checkboxes */}
      <label>Marketing:</label>
      {['Eventos', 'Online', 'TV'].map((opt) => (
        <div key={opt}>
          <input
            type="checkbox"
            checked={selected.marketing.includes(opt)}
            onChange={() => toggleMarketingOption(opt)}
          />
          <span>{opt}</span>
        </div>
      ))}

      {/* Investimentos com Select */}
      <label>Investimentos:</label>
      <select
        value={selected.investimentos}
        onChange={(e) => handleSelect('investimentos', e.target.value)}
      >
        <option value="">Selecione</option>
        <option value="P&D">P&D</option>
        <option value="Expansão">Expansão</option>
      </select>

      {/* PD com Select */}
      <label>PD:</label>
      <select
        value={selected.pd}
        onChange={(e) => handleSelect('pd', e.target.value)}
      >
        <option value="">Selecione</option>
        <option value="Treinamento">Treinamento</option>
        <option value="Infraestrutura">Infraestrutura</option>
      </select>

      {/* Feedback visual */}
      <p style={{ color: restante < 0 ? 'red' : 'green', fontWeight: 'bold' }}>
        Restante: {restante} pontos
      </p>

      <button onClick={handleSave} disabled={restante < 0}>
        Salvar Decisões
      </button>
    </div>
  );
};

export default DecisionCard;

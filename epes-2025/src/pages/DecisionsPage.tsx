import React, { useState, useEffect } from 'react';
import './DecisionPage.css';
import { db, auth } from '../services/firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';

export default function DecisionPage() {
  const creditAvailable = 100;

  const [investimento, setInvestimento] = useState<string[]>([]);
  const [marketing, setMarketing] = useState<string[]>([]);
  const [producao, setProducao] = useState(70);
  const [pd, setPd] = useState<string[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);

  const marketingOptions = [
    { label: 'Online', cost: 10 },
    { label: 'TV', cost: 20 },
    { label: 'Eventos', cost: 15 },
  ];

  const investimentoOptions = [
    { label: 'Tecnologia', cost: 20 },
    { label: 'Infraestrutura', cost: 25 },
    { label: 'Treinamento', cost: 15 },
  ];

  const pdOptions = [
    { label: 'Produto', cost: 10 },
    { label: 'Processo', cost: 15 },
  ];

  const toggleOption = (
    option: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  useEffect(() => {
    const sumCosts = (selected: string[], options: { label: string; cost: number }[]) =>
      selected.reduce((acc, label) => {
        const item = options.find(opt => opt.label === label);
        return acc + (item?.cost || 0);
      }, 0);

    const marketingCost = sumCosts(marketing, marketingOptions);
    const investimentoCost = sumCosts(investimento, investimentoOptions);
    const pdCost = sumCosts(pd, pdOptions);
    const producaoCost = Math.floor(producao / 10);

    setTotalUsed(marketingCost + investimentoCost + producaoCost + pdCost);
  }, [marketing, investimento, producao, pd]);

  const restante = creditAvailable - totalUsed;

  const handleSave = async () => {
    if (restante < 0) return;

    const user = auth.currentUser;
    const codigoTurma = localStorage.getItem('codigoTurma');

    console.log('🔍 Verificando usuário e turma:', user?.email, codigoTurma);

    if (!user || !codigoTurma) {
      alert('Usuário não autenticado ou código da turma ausente.');
      return;
    }

    const decision = {
      investimento,
      marketing,
      producao,
      pd,
      totalUsed,
      creditAvailable,
      email: user.email,
      uid: user.uid,
      codigoTurma,
      timestamp: new Date(),
    };

    try {
      // Salva decisão
      await addDoc(collection(db, 'decisoes'), decision);

      // Salva jogador no ranking
      await setDoc(doc(db, 'jogadores', user.uid), {
        nome: user.displayName || user.email || 'Jogador',
        pontuacao: totalUsed,
      });

      // Salva time no ranking
      await setDoc(doc(db, 'times', codigoTurma), {
        id: codigoTurma,
        nome: `Time ${codigoTurma}`,
        pontuacao: totalUsed,
      });

      // Salva rodada com validações
      await addDoc(collection(db, 'rodadas'), {
        pontuacaoRodada: typeof totalUsed === 'number' ? totalUsed : 0,
        timeId: codigoTurma || 'turma-desconhecida',
        vitoria: totalUsed >= 80,
        timestamp: new Date(),
      });

      alert('Decisão, ranking e rodada salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar decisão:', error);
      alert('Ocorreu um erro ao salvar. Tente novamente.');
    }
  };

  return (
    <div className="container">
      <h1>📊 Decisões da Rodada</h1>

      <div className="credit-box">
        <div className="credit-info">
          <span>Disponível: <strong>{creditAvailable}</strong></span>
          <span>Usado: <strong>{totalUsed}</strong></span>
          <span className={restante < 0 ? 'alert' : 'ok'}>
            Restante: <strong>{restante}</strong>
          </span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${restante < 0 ? 'over' : ''}`}
            style={{ width: `${Math.min((totalUsed / creditAvailable) * 100, 100)}%` }}
          />
        </div>
        {restante < 0 && <p className="alert-text">⚠️ Crédito excedido! Ajuste suas escolhas.</p>}
      </div>

      <div className="cards">
        <div className="card">
          <h2>💼 Investimentos</h2>
          {investimentoOptions.map(opt => (
            <label key={opt.label}>
              <input
                type="checkbox"
                checked={investimento.includes(opt.label)}
                onChange={() => toggleOption(opt.label, investimento, setInvestimento)}
              />
              {opt.label} ({opt.cost} pts)
            </label>
          ))}
        </div>

        <div className="card">
          <h2>📢 Marketing</h2>
          {marketingOptions.map(opt => (
            <label key={opt.label}>
              <input
                type="checkbox"
                checked={marketing.includes(opt.label)}
                onChange={() => toggleOption(opt.label, marketing, setMarketing)}
              />
              {opt.label} ({opt.cost} pts)
            </label>
          ))}
        </div>

        <div className="card">
          <h2>🏭 Produção</h2>
          <input
            type="range"
            min={0}
            max={100}
            value={producao}
            onChange={e => setProducao(Number(e.target.value))}
          />
          <p>{producao}%</p>
        </div>

        <div className="card">
          <h2>🔬 P&D</h2>
          {pdOptions.map(opt => (
            <label key={opt.label}>
              <input
                type="checkbox"
                checked={pd.includes(opt.label)}
                onChange={() => toggleOption(opt.label, pd, setPd)}
              />
              {opt.label} ({opt.cost} pts)
            </label>
          ))}
        </div>
      </div>

      <div className="summary">
        <h3>📋 Resumo da Decisão</h3>
        <p>Produção: {producao}%</p>
        <p>Marketing: {marketing.join(', ') || 'Nenhum'}</p>
        <p>Investimentos: {investimento.join(', ') || 'Nenhum'}</p>
        <p>P&D: {pd.join(', ') || 'Nenhum'}</p>
        <p>
          Créditos restantes:{" "}
          <strong className={restante < 0 ? 'alert' : 'ok'}>{restante}</strong>
        </p>
      </div>

      <div className="save-button">
        <button onClick={handleSave} disabled={restante < 0}>
          💾 Salvar Decisões
        </button>
      </div>
    </div>
  );
}

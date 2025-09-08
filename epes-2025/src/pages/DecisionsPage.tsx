import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import DecisionCard from '../components/DecisionCard';
import CreditBox from '../components/CreditBox';
import Summary from '../components/Summary';
import SaveButton from '../components/SaveButton';
import { sumCosts } from '../utils/CostUtils';
import CronometroRodada from '../components/CronometroRodada';
import Conselheiro from '../components/Conselheiro';
import './DecisionPage.css';

export default function DecisionPage() {
  const navigate = useNavigate();
  const recursoInicial = 100;

  const simulatedLucro = 500;
  const reinvestimentoDisponivel = Math.floor(simulatedLucro * 0.2);
  const caixaAcumulado = Math.floor(simulatedLucro * 0.8);

  const [investimento, setInvestimento] = useState<string[]>([]);
  const [marketing, setMarketing] = useState<string[]>([]);
  const [producao, setProducao] = useState(70);
  const [pd, setPd] = useState<string[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [investimentoCost, setInvestimentoCost] = useState(0);
  const [rodadaAtivaLocal, setRodadaAtivaLocal] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      const dados = docSnap.data();
      setRodadaAtivaLocal(dados?.rodadaAtiva === true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const marketingCost = sumCosts(marketing, marketingOptions);
    const investimentoTotal = sumCosts(investimento, investimentoOptions);
    const pdCost = sumCosts(pd, pdOptions);
    const producaoCost = Math.floor(producao / 10);

    setInvestimentoCost(investimentoTotal);
    setTotalUsed(marketingCost + producaoCost + pdCost);
  }, [marketing, investimento, producao, pd]);

  const restante = recursoInicial - totalUsed;
  const isReinvestimentoExcedido = investimentoCost > reinvestimentoDisponivel;

  const handleSave = async () => {
    // Verifica diretamente no Firestore se a rodada está ativa
    const configRef = doc(db, 'configuracoes', 'geral');
    const configSnap = await getDoc(configRef);
    const configData = configSnap.data();

    if (!configData?.rodadaAtiva) {
      alert('🚫 A rodada está fechada. Aguarde o responsável abrir.');
      return;
    }

    if (restante < 0 || isReinvestimentoExcedido) {
      alert('⚠️ Verifique os pontos alocados. Há excesso ou saldo negativo.');
      return;
    }

    const user = auth.currentUser;
    const codigoTurma = localStorage.getItem('codigoTurma');
    if (!user || !codigoTurma) {
      alert('Usuário não autenticado ou código da turma ausente.');
      return;
    }

    const timeRef = doc(db, 'times', codigoTurma);
    const timeSnap = await getDoc(timeRef);
    const timeData = timeSnap.data();
    if (!timeData || timeData.criadoPor !== user.uid) {
      alert('🚫 Apenas o capitão pode salvar a rodada.');
      return;
    }

    const decision = {
      investimento,
      marketing,
      producao,
      pd,
      totalUsed,
      investimentoCost,
      reinvestimentoDisponivel,
      caixaAcumulado,
      recursoInicial,
      email: user.email,
      uid: user.uid,
      codigoTurma,
      timestamp: new Date(),
    };

    try {
      await addDoc(collection(db, 'decisoes'), decision);

      await setDoc(doc(db, 'jogadores', user.uid), {
        nome: user.displayName || user.email || 'Jogador',
        pontuacao: totalUsed,
      });

      await setDoc(doc(db, 'times', codigoTurma), {
        pontuacao: totalUsed,
        caixaAcumulado,
      }, { merge: true });

      await addDoc(collection(db, 'rodadas'), {
        pontuacaoRodada: typeof totalUsed === 'number' ? totalUsed : 0,
        timeId: codigoTurma || 'turma-desconhecida',
        vitoria: totalUsed >= 80,
        timestamp: new Date(),
      });

      alert('✅ Decisão, pontuação e rodada salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar decisão:', error);
      alert('Ocorreu um erro ao salvar. Tente novamente.');
    }
  };

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
    label: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  return (
    <div className="container">
      <h1>📊 Decisões da Rodada</h1>

      {!rodadaAtivaLocal && (
        <div style={{
          backgroundColor: '#ffe0e0',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '15px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          🚫 A rodada está fechada. Aguarde o responsável abrir para salvar suas decisões.
        </div>
      )}

      <CronometroRodada modo="jogador" />

      <CreditBox
        recursoInicial={recursoInicial}
        totalUsed={totalUsed}
        restante={restante}
        isReinvestimentoExcedido={isReinvestimentoExcedido}
        reinvestimentoDisponivel={reinvestimentoDisponivel}
      />

      <div className="cards">
        <DecisionCard
          title="💼 Investimentos"
          options={investimentoOptions}
          selected={investimento}
          toggle={label => toggleOption(label, investimento, setInvestimento)}
        />
        <DecisionCard
          title="📢 Marketing"
          options={marketingOptions}
          selected={marketing}
          toggle={label => toggleOption(label, marketing, setMarketing)}
        />
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
        <DecisionCard
          title="🔬 P&D"
          options={pdOptions}
          selected={pd}
          toggle={label => toggleOption(label, pd, setPd)}
        />
      </div>

      <Summary
        producao={producao}
        marketing={marketing}
        investimento={investimento}
        investimentoCost={investimentoCost}
        pd={pd}
        restante={restante}
        reinvestimentoDisponivel={reinvestimentoDisponivel}
        caixaAcumulado={caixaAcumulado}
      />

      <SaveButton
        onSave={handleSave}
        disabled={!rodadaAtivaLocal || restante < 0 || isReinvestimentoExcedido}
      />

      <Conselheiro
  restante={restante}
  isReinvestimentoExcedido={isReinvestimentoExcedido}
  rodadaAtiva={rodadaAtivaLocal}
/>


    </div>
  );
}

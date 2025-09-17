import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs, // ✅ adicione aqui
  onSnapshot,
} from 'firebase/firestore';
import DecisionCard from '../components/DecisionCard';
import CreditBox from '../components/CreditBox';
import Summary from '../components/Summary';
import SaveButton from '../components/SaveButton';
import { sumCosts } from '../utils/CostUtils';
import CronometroRodada from '../components/CronometroRodada';
import Conselheiro from '../components/Conselheiro';
import { calcularRodada } from '../services/calcularRodadas';
import UpgradeLimitBar from '../components/UpgradeLimitBar';
import PriceSelector from '../components/PriceSelector';
import './DecisionPage.css';

export default function DecisionPage() {
  const navigate = useNavigate();
  const recursoInicial = 100;
  const precoBase = 100;

  const [lucroAnterior, setLucroAnterior] = useState(0);
  const [investimento, setInvestimento] = useState<string[]>([]);
  const [marketing, setMarketing] = useState<string[]>([]);
  const [producao, setProducao] = useState(70);
  const [pd, setPd] = useState<string[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [investimentoCost, setInvestimentoCost] = useState(0);
  const [resultadoPreview, setResultadoPreview] = useState<any>(null);

  const [rodadaAtivaLocal, setRodadaAtivaLocal] = useState(false);
  const [precoEscolhido, setPrecoEscolhido] = useState(precoBase);

  const reinvestimentoDisponivel = Math.floor(lucroAnterior * 0.2);
  const caixaAcumulado = Math.floor(lucroAnterior * 0.8);
  const limiteUpgrades = reinvestimentoDisponivel + caixaAcumulado;
  const custoUpgrades = investimentoCost;
  const isUpgradeExcedido = custoUpgrades > limiteUpgrades;
  const restante = recursoInicial - totalUsed;
  const precoMin = precoBase * 0.8;
  const precoMax = precoBase * 1.2;

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      const dados = docSnap.data();
      setRodadaAtivaLocal(dados?.rodadaAtiva === true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchLucro = async () => {
      const codigoTurma = localStorage.getItem('codigoTurma');
      if (!codigoTurma) return;

      const timeRef = doc(db, 'times', codigoTurma);
      const timeSnap = await getDoc(timeRef);
      const timeData = timeSnap.data();
      setLucroAnterior(timeData?.lucroAnterior ?? 0);
    };

    fetchLucro();
  }, []);

  useEffect(() => {
    const marketingCost = sumCosts(marketing, marketingOptions);
    const investimentoTotal = sumCosts(investimento, investimentoOptions);
    const pdCost = sumCosts(pd, pdOptions);
    const producaoCost = Math.floor(producao / 10);

    setInvestimentoCost(investimentoTotal);
    setTotalUsed(marketingCost + producaoCost + pdCost);
  }, [marketing, investimento, producao, pd]);

  useEffect(() => {
  const houveBacklogAnterior = localStorage.getItem('houveBacklog') === 'true';

  const preview = calcularRodada({
    preco: precoEscolhido,
    produto: investimentoCost,
    marketing: sumCosts(marketing, marketingOptions),
    capacidade: Math.floor(producao / 10),
    equipe: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Treinamento")),
    beneficio: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Infraestrutura")),
    publicoAlvo: "classe-cd", // ou dinâmico se quiser
    caixaAcumulado,
    atraso: false,
    penalidadeBacklog: houveBacklogAnterior, // ✅ aqui está a penalidade
  });

  setResultadoPreview(preview);
}, [
  precoEscolhido,
  investimentoCost,
  marketing,
  producao,
  investimento,
  caixaAcumulado,
  pd
]);


  const handleSave = async () => {
    const configRef = doc(db, 'configuracoes', 'geral');
    const configSnap = await getDoc(configRef);
    const configData = configSnap.data();

    if (!configData?.rodadaAtiva) {
      alert('🚫 A rodada está fechada. Aguarde o responsável abrir.');
      return;
    }

    if (restante < 0 || isUpgradeExcedido) {
      alert('⚠️ Verifique os pontos alocados. Há excesso ou saldo negativo.');
      return;
    }

    if (precoEscolhido < precoMin || precoEscolhido > precoMax) {
      alert("⚠️ O preço escolhido está fora da faixa permitida.");
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
      precoEscolhido,
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
        lucroAnterior,
      }, { merge: true });

      const snapshot = await getDocs(collection(db, 'rodadas'));
const rodadasAtuais = snapshot.docs
  .map(doc => doc.data())
  .filter(r => r.versao === "2025" && r.timeId !== codigoTurma && typeof r.ea === "number");

const eaDosOutrosTimes = rodadasAtuais.map(r => r.ea);


      const resultado = calcularRodada({
        preco: precoEscolhido,
        produto: investimentoCost,
        marketing: sumCosts(marketing, marketingOptions),
        capacidade: Math.floor(producao / 10),
        equipe: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Treinamento")),
        beneficio: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Infraestrutura")),
        publicoAlvo: timeData.publicoAlvo ?? "classe-cd",
        caixaAcumulado,
        atraso: false,
        eaDosOutrosTimes,
      });

      const houveEvento = Math.random() < 0.3; // 30% de chance
const estaProtegido = investimento.includes("Proteção de Marca");

if (houveEvento && !estaProtegido) {
  resultado.ea = Math.max(0, resultado.ea - 10); // penalidade de EA
  resultado.evento = "🚨 Crise de reputação! Sem proteção de marca, o EA caiu.";
} else if (houveEvento && estaProtegido) {
  resultado.evento = "🛡️ Evento de crise bloqueado pela proteção de marca.";
}


      localStorage.setItem('houveBacklog', resultado.backlog ? 'true' : 'false');


      await addDoc(collection(db, 'rodadas'), {
        ...resultado,
        timeId: codigoTurma,
        versao: "2025",
        atraso: false,
        status: "✅",
        timestamp: new Date(),
      });

      alert('✅ Decisão e rodada calculada com sucesso!');
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
    { label: 'Proteção de Marca', cost: 20 }

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
        isReinvestimentoExcedido={isUpgradeExcedido}
        reinvestimentoDisponivel={reinvestimentoDisponivel}
      />

      <UpgradeLimitBar
        custoUpgrades={custoUpgrades}
        limiteUpgrades={limiteUpgrades}
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

       <PriceSelector
  precoBase={precoBase}
  precoEscolhido={precoEscolhido}
  setPrecoEscolhido={setPrecoEscolhido}
      />


        <DecisionCard
          title="🔬 P&D"
          options={pdOptions}
          selected={pd}
          toggle={label => toggleOption(label, pd, setPd)}
        />
      </div>

      <Summary
  producao={producao}
  producaoCost={Math.floor(producao / 10)}
  marketing={marketing}
  marketingCost={sumCosts(marketing, marketingOptions)}
  investimento={investimento}
  investimentoCost={investimentoCost}
  pd={pd}
  pdCost={sumCosts(pd, pdOptions)}
  precoEscolhido={precoEscolhido}
  restante={restante}
  reinvestimentoDisponivel={reinvestimentoDisponivel}
  caixaAcumulado={caixaAcumulado}
  ea={resultadoPreview?.ea}
  caixaFinal={resultadoPreview?.caixaFinal}
  cvu={resultadoPreview?.cvu}
  backlog={resultadoPreview?.backlog} // ✅ aqui!
/>


      <SaveButton
        onSave={handleSave}
        disabled={!rodadaAtivaLocal || restante < 0 || isUpgradeExcedido}
      />

      <Conselheiro
        restante={restante}
        isReinvestimentoExcedido={isUpgradeExcedido}
        rodadaAtiva={rodadaAtivaLocal}
      />



    </div>
  );
}










import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../services/firebase';
import {
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import DecisionCard from '../components/DecisionCard';
import CreditBox from '../components/CreditBox';
import Summary from '../components/Summary';
import SaveButton from '../components/SaveButton';
import UpgradeLimitBar from '../components/UpgradeLimitBar';
import CronometroRodada from '../components/CronometroRodada';
import Conselheiro from '../components/Conselheiro';
import { calcularRodada } from '../services/calcularRodadas';
import { sumCosts } from '../utils/CostUtils';
import './DecisionPage.css';

export default function DecisionPage() {
  const navigate = useNavigate();
  const recursoInicial = 100;

  const [investimento, setInvestimento] = useState<string[]>([]);
  const [marketing, setMarketing] = useState<string[]>([]);
  const [producao, setProducao] = useState(0);
  const [pd, setPd] = useState<string[]>([]);
  const [totalUsed, setTotalUsed] = useState(0);
  const [investimentoCost, setInvestimentoCost] = useState(0);
  const [rodadaAtivaLocal, setRodadaAtivaLocal] = useState(false);
  const [lucroAnterior, setLucroAnterior] = useState(0);
  const [isCapitao, setIsCapitao] = useState(false);
  const [resultadoPreview, setResultadoPreview] = useState<any>(null);
  const [custoUpgrades, setCustoUpgrades] = useState(0);
  const [limiteUpgrades, setLimiteUpgrades] = useState(0);
  const [rodadaFoiSalva, setRodadaFoiSalva] = useState(false);
  const [precoEscolhido, setPrecoEscolhido] = useState(100);

  const marketingOptions = [
    { label: 'Online', cost: 10 },
    { label: 'TV', cost: 20 },
    { label: 'Eventos', cost: 15 },
  ];

  const investimentoOptions = [
    { label: 'Tecnologia', cost: 20 },
    { label: 'Infraestrutura', cost: 25 },
    { label: 'Treinamento', cost: 15 },
    { label: 'Proteção de Marca', cost: 20 },
  ];

  const pdOptions = [
    { label: 'Produto', cost: 10 },
    { label: 'Processo', cost: 15 },
  ];

useEffect(() => {
  const investimentoTotal = sumCosts(investimento, investimentoOptions);
  const marketingTotal = sumCosts(marketing, marketingOptions);
  const pdTotal = sumCosts(pd, pdOptions);
  const producaoTotal = Math.floor(producao / 10);

  setInvestimentoCost(investimentoTotal);
  setTotalUsed(investimentoTotal + marketingTotal + pdTotal + producaoTotal);
}, [investimento, marketing, pd, producao]);


  const reinvestimentoDisponivel = Math.floor(lucroAnterior * 0.2);
  const caixaAcumulado = Math.floor(lucroAnterior * 0.8);
  const restante = recursoInicial - totalUsed;
  const isUpgradeExcedido = custoUpgrades > limiteUpgrades;

  const producaoCost = Math.floor(producao / 10);
  const marketingCost = sumCosts(marketing, marketingOptions);
  const pdCost = sumCosts(pd, pdOptions);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      const dados = docSnap.data();
      setRodadaAtivaLocal(dados?.rodadaAtiva === true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchLucroECapitao = async () => {
      const codigoTurma = localStorage.getItem('codigoTurma');
      const user = auth.currentUser;
      if (!codigoTurma || !user) return;

      const timeRef = doc(db, 'times', codigoTurma);
      const timeSnap = await getDoc(timeRef);
      const timeData = timeSnap.data();

      setLucroAnterior(timeData?.lucroAnterior ?? 0);
      setIsCapitao(timeData?.criadoPor === user.uid);
    };
    fetchLucroECapitao();
  }, []);

  useEffect(() => {
    const houveBacklogAnterior = localStorage.getItem('houveBacklog') === 'true';

    if (
      investimento.length === 0 &&
      marketing.length === 0 &&
      pd.length === 0 &&
      producao === 0
    ) return;

    const preview = calcularRodada({
      preco: precoEscolhido,
      produto: investimentoCost,
      marketing: sumCosts(marketing, marketingOptions),
      capacidade: Math.floor(producao / 10),
      equipe: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Treinamento")),
      beneficio: sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Infraestrutura")),
      publicoAlvo: "classe-cd",
      caixaAcumulado,
      atraso: false,
      penalidadeBacklog: houveBacklogAnterior,
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

  useEffect(() => {
    const custoInfra = sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Infraestrutura"));
    const custoTreinamento = sumCosts(investimento, investimentoOptions.filter(opt => opt.label === "Treinamento"));
    setCustoUpgrades(custoInfra + custoTreinamento);

    const reinvestimento = Math.floor(lucroAnterior * 0.2);
    const caixa = Math.floor(lucroAnterior * 0.8);
    setLimiteUpgrades(reinvestimento + caixa);
  }, [investimento, lucroAnterior]);

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

    if (
      investimento.length === 0 &&
      marketing.length === 0 &&
      pd.length === 0 &&
      producao === 0
    ) {
      alert("⚠️ Você precisa fazer escolhas antes de salvar a rodada.");
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

    const rodadasSnap = await getDocs(collection(db, 'rodadas'));
    const rodadasInvalidas = rodadasSnap.docs.filter(doc => {
      const r = doc.data();
      return r.timeId === codigoTurma && (r.ea === 0 || isNaN(r.lucro) || isNaN(r.caixaFinal));
    });
    for (const docInv of rodadasInvalidas) {
      await deleteDoc(doc(db, 'rodadas', docInv.id));
    }

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
      eaDosOutrosTimes: [],
    });

    if (
      !resultado ||
      typeof resultado !== "object" ||
      !Number.isFinite(resultado.ea) ||
      !Number.isFinite(resultado.lucro) ||
      !Number.isFinite(resultado.caixaFinal) ||
      !Number.isFinite(resultado.receita) ||
      resultado.ea === 0 ||
      resultado.demanda === 0
    ) {
      alert("⚠️ Os dados da rodada estão incompletos ou inválidos. Verifique suas escolhas.");
      return;
    }

    const caixaFinalValido = Number.isFinite(resultado.caixaFinal) ? resultado.caixaFinal : 0;
    const lucroValido = Number.isFinite(resultado.lucro) ? resultado.lucro : 0;
    const satisfacaoValida = Number.isFinite(resultado.satisfacao) ? resultado.satisfacao : 0;

    await setDoc(doc(db, 'times', codigoTurma), {
      caixaAcumulado: caixaFinalValido,
      lucroTotal: lucroValido,
      satisfacaoMedia: satisfacaoValida,
      pontuacao: totalUsed,
      nome: user.displayName || user.email || "Time sem nome",
    }, { merge: true });

    const resultadoLimpo = Object.fromEntries(
  Object.entries(resultado).filter(([_, v]) => v !== undefined)
);

   await addDoc(collection(db, 'rodadas'), {
  ...resultadoLimpo,
  timeId: codigoTurma,
  versao: "2025",
  atraso: false,
  status: "✅",
  timestamp: Timestamp.now(),
});


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
      timestamp: Timestamp.now(),
    };

    try {
      await addDoc(collection(db, 'decisoes'), decision);

      await setDoc(doc(db, 'jogadores', user.uid), {
        nome: user.displayName || user.email || 'Jogador',
        pontuacao: totalUsed,
      });

      setRodadaFoiSalva(true);
      alert('✅ Decisão e rodada calculada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar decisão:', error);
      alert('Ocorreu um erro ao salvar. Tente novamente.');
    }
  };

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
        <div className="alert-box">
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
        <DecisionCard
          title="🔬 P&D"
          options={pdOptions}
          selected={pd}
          toggle={label => toggleOption(label, pd, setPd)}
        />
      </div>

      <Summary
        producao={producao}
        producaoCost={producaoCost}
        marketing={marketing}
        marketingCost={marketingCost}
        investimento={investimento}
        investimentoCost={investimentoCost}
        pd={pd}
        pdCost={pdCost}
        precoEscolhido={precoEscolhido}
        restante={restante}
        reinvestimentoDisponivel={reinvestimentoDisponivel}
        caixaAcumulado={caixaAcumulado}
        ea={resultadoPreview?.ea}
        caixaFinal={resultadoPreview?.caixaFinal}
        cvu={resultadoPreview?.cvu}
        backlog={resultadoPreview?.backlog}
        rodadaAtiva={rodadaAtivaLocal}
        isCapitao={isCapitao}
        rodadaFoiSalva={rodadaFoiSalva}
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

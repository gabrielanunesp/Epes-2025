import React, { useEffect, useState } from "react";
import { db, auth } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { calcularRodada } from "../services/calcularRodadas";
import "./DecisionPage.css";

export default function DecisionPage() {
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [membros, setMembros] = useState<{ uid: string }[]>([]);
  const [rodadaAtiva, setRodadaAtiva] = useState(false);
  const [tempoRestante, setTempoRestante] = useState("");
  const [mensagemCapitao, setMensagemCapitao] = useState("");
  const [uid, setUid] = useState("");
  const [isCapitao, setIsCapitao] = useState(false);

  const codigoTurma = localStorage.getItem("codigoTurma") ?? "";

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    if (user?.uid) {
      setUid(user.uid);

      if (!codigoTurma) return;


      const timeRef = doc(db, "times", codigoTurma);
      const timeSnap = await getDoc(timeRef);
      const timeData = timeSnap.data();

      if (timeData?.criadoPor === user.uid) {
        setIsCapitao(true);
      }
    }
  });

  return () => unsubscribe();
}, []);

  const [produtoIndex, setProdutoIndex] = useState(0);
  const [marketingIndex, setMarketingIndex] = useState(0);
  const [capacidadeIndex, setCapacidadeIndex] = useState(1);
  const [equipeIndex, setEquipeIndex] = useState(0);
  const [marcaProtegida, setMarcaProtegida] = useState(false);
  const [beneficioIndex, setBeneficioIndex] = useState(3);

  const produtoOpcoes = ["Básico", "Intermediário", "Avançado", "Premium"];
  const marketingOpcoes = ["Local", "Regional", "Nacional", "Nacional + Influenciadores"];
  const capacidadeOpcoes = ["500 unidades", "1.000 unidades", "2.000 unidades", "3.000 unidades"];
  const equipeOpcoes = ["Enxuto", "Balanceado", "Reforçado", "Especializado"];
  const beneficioOpcoes = ["Cupom", "Brinde", "Frete grátis", "Nenhum"];

  const preco = 100;
  const limiteInvestimento = 500000;

  const qualidade = [10, 20, 35, 50][produtoIndex];
  const marketingBonus = [8, 15, 25, 35][marketingIndex];
  const capacidade = [500, 1000, 2000, 3000][capacidadeIndex];
  const equipeBonus = [5, 15, 25, 30][equipeIndex];
  const beneficioBonus = [10, 15, 20, 0][beneficioIndex];
  const custoProtecao = marcaProtegida ? 80000 : 0;

  const totalUsado =
    [50000, 100000, 200000, 300000][produtoIndex] +
    [50000, 100000, 200000, 300000][marketingIndex] +
    [50000, 100000, 200000, 300000][capacidadeIndex] +
    [50000, 100000, 200000, 300000][equipeIndex] +
    [50000, 80000, 100000, 0][beneficioIndex] +
    custoProtecao;

  const caixaRestante = limiteInvestimento - totalUsado;
  const passouDoLimite = caixaRestante < 0;

  const formatar = (valor: number) =>
    new Intl.NumberFormat("pt-BR").format(valor);

  useEffect(() => {
    const carregarDados = async () => {
      const empresaRef = doc(db, "empresas", codigoTurma);
      const geralRef = doc(db, "configuracoes", "geral");

      const [empresaSnap, geralSnap] = await Promise.all([
        getDoc(empresaRef),
        getDoc(geralRef),
      ]);

      const empresaData = empresaSnap.data();
      const geralData = geralSnap.data();

      if (empresaData?.publicoAlvo) {
        setPublicoAlvo(empresaData.publicoAlvo);
      }

      if (empresaData?.membros) {
        setMembros(empresaData.membros);
      }

      setRodadaAtiva(geralData?.rodadaAtiva === true);
    };

    carregarDados();
  }, [codigoTurma]);

  useEffect(() => {
    if (!rodadaAtiva) return;

    const atualizarTempo = () => {
      const agora = new Date();
      const fim = new Date();
      fim.setHours(23, 59, 0, 0);

      const diff = Math.max(0, fim.getTime() - agora.getTime());
      const horas = Math.floor(diff / 3600000);
      const minutos = Math.floor((diff % 3600000) / 60000);
      setTempoRestante(`${horas}h ${minutos}m`);
    };

    atualizarTempo(); // chama imediatamente

    const interval = setInterval(atualizarTempo, 60000);
    return () => clearInterval(interval);
  }, [rodadaAtiva]);

  const resultado = calcularRodada({
    preco,
    qualidade,
    marketingBonus,
    equipeBonus,
    beneficioBonus,
    capacidade,
    publicoAlvo,
    caixaAcumulado: 0,
  });

  const salvarDecisao = async () => {
    const timeId = localStorage.getItem("idDoTime");

      const geralRef = doc(db, "configuracoes", "geral");
  const geralSnap = await getDoc(geralRef);
  const rodadaAtual = geralSnap.data()?.rodadaAtual ?? 1;


    if (!isCapitao) {
      setMensagemCapitao("🔒 Apenas o capitão pode enviar a decisão final.");
      return;
    }

    if (!rodadaAtiva || passouDoLimite) return;

    if (!uid || !codigoTurma || !timeId || uid.trim() === "" || timeId.trim() === "") {
      setMensagemCapitao("⚠️ Informações incompletas. Verifique login e se você escolheu um time.");
      return;
    }

    const dados = {
  produto: produtoOpcoes[produtoIndex],
  marketing: marketingOpcoes[marketingIndex],
  capacidade,
  equipe: equipeOpcoes[equipeIndex],
  marca: marcaProtegida,
  beneficio: beneficioOpcoes[beneficioIndex],
  preco,
  totalUsado,
  caixaRestante,
  publicoAlvo,
  ea: resultado.ea ?? 0,
  share: resultado.share ?? 0,
  demanda: resultado.demanda ?? 0,
  receita: resultado.receita ?? 0,
  custo: resultado.custo ?? 0,           // ✅ novo campo
  lucro: resultado.lucro ?? 0,
  reinvestimento: resultado.reinvestimento ?? 0, // ✅ novo campo
  caixaFinal: resultado.caixaFinal ?? 0,
  satisfacao: resultado.satisfacao ?? 0, // ✅ novo campo
  timestamp: new Date(),
  codigoTurma,
  uid,
  timeId,
};


    await setDoc(doc(db, "decisoes", `${codigoTurma}_rodada${rodadaAtual}_${uid}`), dados);
    await setDoc(doc(db, "rodadas", codigoTurma, `rodada${rodadaAtual}`, uid), {

  timeId: timeId,
  ea: resultado.ea,
  demanda: resultado.demanda,
  receita: resultado.receita,
  custo: resultado.custo,
  lucro: resultado.lucro,
  reinvestimento: resultado.reinvestimento,
  caixaFinal: resultado.caixaFinal,
  satisfacao: resultado.satisfacao,
  atraso: false,
  status: "✅",
  timestamp: new Date(),
});

await setDoc(doc(db, "rodadas", `${codigoTurma}_rodada${rodadaAtual}_${uid}`), {

  ...dados,
  status: "✅"
});



    setMensagemCapitao("✅ Decisão salva com sucesso!");
   

  };
  return (
    <div className="decision-container">
      <h2>📊 Decisões Estratégicas</h2>

      <div className="decision-block">
        <label>🔬 Produto & P&D:</label>
        <select value={produtoIndex} onChange={(e) => setProdutoIndex(Number(e.target.value))}>
          {produtoOpcoes.map((op, i) => (
            <option key={i} value={i}>{op}</option>
          ))}
        </select>
      </div>

      <div className="decision-block">
        <label>📢 Marketing & Branding:</label>
        <select value={marketingIndex} onChange={(e) => setMarketingIndex(Number(e.target.value))}>
          {marketingOpcoes.map((op, i) => (
            <option key={i} value={i}>{op}</option>
          ))}
        </select>
      </div>

      <div className="decision-block">
        <label>🏭 Capacidade Operacional:</label>
        <select value={capacidadeIndex} onChange={(e) => setCapacidadeIndex(Number(e.target.value))}>
          {capacidadeOpcoes.map((op, i) => (
            <option key={i} value={i}>{op}</option>
          ))}
        </select>
      </div>

      <div className="decision-block">
        <label>👥 Equipe & Treinamento:</label>
        <select value={equipeIndex} onChange={(e) => setEquipeIndex(Number(e.target.value))}>
          {equipeOpcoes.map((op, i) => (
            <option key={i} value={i}>{op}</option>
          ))}
        </select>
      </div>

      <div className="decision-block">
        <label>🛡️ Proteção de Marca:</label>
        <select value={marcaProtegida ? "sim" : "nao"} onChange={(e) => setMarcaProtegida(e.target.value === "sim")}>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      </div>

      <div className="decision-block">
        <label>🎁 Benefício de Lançamento:</label>
        <select value={beneficioIndex} onChange={(e) => setBeneficioIndex(Number(e.target.value))}>
          {beneficioOpcoes.map((op, i) => (
            <option key={i} value={i}>{op}</option>
          ))}
        </select>
      </div>

      <p><strong>💸 Total usado:</strong> R$ {formatar(totalUsado)}</p>
      <p><strong>🧮 Caixa restante:</strong> R$ {formatar(caixaRestante)}</p>

      <h3 style={{ marginTop: "2rem" }}>📋 Resumo das Decisões</h3>
      <div className="indicators">
        <p>📈 EA: {resultado.ea}</p>
        <p>📊 Share: {resultado.share}%</p>
        <p>🛍️ Demanda: {formatar(resultado.demanda)}</p>
        <p>💰 Receita: R$ {formatar(resultado.receita)}</p>
        <p>📉 Lucro: R$ {formatar(resultado.lucro)}</p>
        <p>🏦 Caixa Final: R$ {formatar(resultado.caixaFinal)}</p>
      </div>

      {!rodadaAtiva && (
        <div className="alert red">⛔ A rodada está fechada. Aguarde o responsável iniciar a próxima rodada.</div>
      )}

      {rodadaAtiva && (
        <div className="alert green">✅ Rodada ativa! Tempo restante: ⏱️ {tempoRestante}</div>
      )}

      {passouDoLimite && (
        <div className="alert red">❌ Você ultrapassou o limite de investimento. Ajuste suas decisões para continuar.</div>
      )}

      {mensagemCapitao && (
        <div className="alert gray">{mensagemCapitao}</div>
      )}

      <button
        className="save-button"
        disabled={!rodadaAtiva || passouDoLimite}
        onClick={salvarDecisao}
      >
        💾 Salvar Decisão
      </button>
    </div>
  );
}

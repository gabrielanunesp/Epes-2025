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

  const uid = localStorage.getItem("uid") ?? "";
  const codigoTurma = localStorage.getItem("codigoTurma") ?? "";
  const isCapitao = membros.length > 0 && membros[0].uid === uid;

  // Decisões
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

      if (geralData?.rodadaAtiva === true) {
        setRodadaAtiva(true);
      } else {
        setRodadaAtiva(false);
      }

      if (geralData?.prazo) {
        const fim = new Date(geralData.prazo.seconds * 1000);
        const agora = new Date();
        const diff = Math.max(0, fim.getTime() - agora.getTime());
        const minutos = Math.floor(diff / 60000);
        const segundos = Math.floor((diff % 60000) / 1000);
        setTempoRestante(`${minutos}m ${segundos}s`);
      }
    };

    carregarDados();
  }, [codigoTurma]);
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
    if (!isCapitao) {
      setMensagemCapitao("🔒 Apenas o capitão pode enviar a decisão final.");
      return;
    }

    if (!rodadaAtiva || passouDoLimite) return;

    const dados = {
      produto: produtoOpcoes[produtoIndex],
      marketing: marketingOpcoes[marketingIndex],
      capacidade: capacidade,
      equipe: equipeOpcoes[equipeIndex],
      marca: marcaProtegida,
      beneficio: beneficioOpcoes[beneficioIndex],
      preco,
      totalUsado,
      caixaRestante,
      publicoAlvo,
      ...resultado,
      timestamp: new Date(),
      codigoTurma,
      uid,
    };

    await setDoc(doc(db, "decisoes", `${codigoTurma}/rodada1/${uid}`), dados);
    await setDoc(doc(db, "rodadas", `${codigoTurma}/rodada1`), {
      [uid]: dados,
    });

    setMensagemCapitao("✅ Decisão salva com sucesso!");
  };

  return (
    <div className="decision-container">
      <h2>📊 Decisões Estratégicas</h2>

      <div className="decision-block">
        <label>🔬 Produto & P&D:</label>
        <select value={produtoIndex} onChange={(e) => setProdutoIndex(Number(e.target.value))}>
          {produtoOpcoes.map((op, i) => <option key={i} value={i}>{op}</option>)}
        </select>
      </div>

      <div className="decision-block">
        <label>📢 Marketing & Branding:</label>
        <select value={marketingIndex} onChange={(e) => setMarketingIndex(Number(e.target.value))}>
          {marketingOpcoes.map((op, i) => <option key={i} value={i}>{op}</option>)}
        </select>
      </div>

      <div className="decision-block">
        <label>🏭 Capacidade Operacional:</label>
        <select value={capacidadeIndex} onChange={(e) => setCapacidadeIndex(Number(e.target.value))}>
          {capacidadeOpcoes.map((op, i) => <option key={i} value={i}>{op}</option>)}
        </select>
      </div>

      <div className="decision-block">
        <label>👥 Equipe & Treinamento:</label>
        <select value={equipeIndex} onChange={(e) => setEquipeIndex(Number(e.target.value))}>
          {equipeOpcoes.map((op, i) => <option key={i} value={i}>{op}</option>)}
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
          {beneficioOpcoes.map((op, i) => <option key={i} value={i}>{op}</option>)}
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

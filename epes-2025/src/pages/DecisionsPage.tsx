import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../services/firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { calcularRodada } from "../services/calcularRodadas";
import { useNavigate } from "react-router-dom";
import "./DecisionPage.css";

export default function DecisionPage() {
  const navigate = useNavigate();

  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [membros, setMembros] = useState<{ uid: string; role?: string; isCapitao?: boolean }[]>([]);
  const [rodadaAtiva, setRodadaAtiva] = useState(false);
  const [rodadaAtual, setRodadaAtual] = useState(1);
  const [tempoRestante, setTempoRestante] = useState("");
  const [mensagemCapitao, setMensagemCapitao] = useState("");
  const [uid, setUid] = useState("");
  const [isCapitao, setIsCapitao] = useState(false);

  // marketSize e orçamento dinâmico
  const [marketSize, setMarketSize] = useState<number>(10000);
  const [orcamentoRodada, setOrcamentoRodada] = useState<number>(500000);

  const codigoTurma = localStorage.getItem("codigoTurma") ?? "";
  const timeIdLS = localStorage.getItem("idDoTime") ?? "";

  // --------- auth + capitao ---------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user?.uid) {
        setUid(user.uid);
        if (!codigoTurma) return;

        const timeRef = doc(db, "times", codigoTurma);
        const timeSnap = await getDoc(timeRef);
        const timeData: any = timeSnap.data();

        const isOwner = timeData?.criadoPor === user.uid;
        const isMemberCaptain = Array.isArray(timeData?.membros)
          ? timeData.membros.some(
              (m: any) =>
                m?.uid === user.uid &&
                m?.status === "aprovado" &&
                (m?.role === "capitao" || m?.isCapitao === true)
            )
          : false;

        setIsCapitao(!!(isOwner || isMemberCaptain));
      }
    });
    return () => unsubscribe();
  }, [codigoTurma]);

  // --------- estados de decisão -----------
  // PREÇO: mantém estrutura, mas com select fixo
  const opcoesPreco = [70, 90, 100, 110, 120];
  const [preco, setPreco] = useState<number>(100);

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

  const caixaRestante = orcamentoRodada - totalUsado;
  const passouDoLimite = caixaRestante < 0;

  const formatar = (valor: number) => new Intl.NumberFormat("pt-BR").format(valor);

  // --------- carregar empresa + geral + orcamento dinâmico ----------
  useEffect(() => {
    const carregar = async () => {
      const empresaRef = doc(db, "empresas", codigoTurma);
      const geralRef = doc(db, "configuracoes", "geral");

      const [empresaSnap, geralSnap] = await Promise.all([getDoc(empresaRef), getDoc(geralRef)]);
      const empresaData: any = empresaSnap.data();
      const geralData: any = geralSnap.data();

      if (empresaData?.publicoAlvo) setPublicoAlvo(empresaData.publicoAlvo);
      if (empresaData?.membros) setMembros(empresaData.membros);

      setRodadaAtiva(geralData?.rodadaAtiva === true);
      setRodadaAtual(geralData?.rodadaAtual ?? 1);

      setMarketSize(typeof geralData?.marketSize === "number" ? Number(geralData.marketSize) : 10000);

      // orçamento = 500k + soma(reinvestimento oficial) das rodadas anteriores
      await calcularOrcamentoDinamico(geralData?.rodadaAtual ?? 1);
    };

    const calcularOrcamentoDinamico = async (rodadaAtualServer: number) => {
      try {
        const tId = localStorage.getItem("idDoTime");
        if (!tId) {
          setOrcamentoRodada(500000);
          return;
        }

        let somaReinvest = 0;
        for (let r = 1; r < rodadaAtualServer; r++) {
          const docRef = doc(db, "resultadosOficiais", tId, `rodada${r}`, "oficial");
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const d: any = snap.data();
            const reinv = Number(d?.reinvestimento ?? 0);
            if (!isNaN(reinv)) somaReinvest += reinv;
          }
        }
        setOrcamentoRodada(500000 + somaReinvest);
      } catch {
        setOrcamentoRodada(500000);
      }
    };

    carregar();
  }, [codigoTurma]);

  // --------- cronômetro 23:59 ----------
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
    atualizarTempo();
    const interval = setInterval(atualizarTempo, 60000);
    return () => clearInterval(interval);
  }, [rodadaAtiva]);

  // --------- PREVIEW local ----------
  const resultado = useMemo(
    () =>
      calcularRodada({
        preco,               // agora variável
        qualidade,
        marketingBonus,
        equipeBonus,
        beneficioBonus,
        capacidade,
        publicoAlvo,
        caixaAcumulado: 0,
        marketSize,          // vem do Firestore
      }),
    [
      preco,
      qualidade,
      marketingBonus,
      equipeBonus,
      beneficioBonus,
      capacidade,
      publicoAlvo,
      marketSize,
    ]
  );

  const vendasEstimadas = useMemo(() => {
    const demanda = Number.isFinite(resultado.demanda) ? resultado.demanda : 0;
    return Math.min(demanda, capacidade, marketSize);
  }, [resultado.demanda, capacidade, marketSize]);

  // --------- salvar decisão ----------
  const salvarDecisao = async () => {
    try {
      const timeId = localStorage.getItem("idDoTime");

      const geralRef = doc(db, "configuracoes", "geral");
      const geralSnap = await getDoc(geralRef);
      const rodadaAtualServer = geralSnap.data()?.rodadaAtual ?? 1;

      if (!isCapitao) {
        setMensagemCapitao("🔒 Apenas o capitão pode enviar a decisão final.");
        return;
      }
      if (!rodadaAtiva || passouDoLimite) return;

      if (!uid || !codigoTurma || !timeId || uid.trim() === "" || timeId.trim() === "") {
        setMensagemCapitao("⚠️ Informações incompletas. Verifique login e se você escolheu um time.");
        return;
      }

      // 1 por rodada (por capitão/time)
      const decisaoId = `${codigoTurma}_rodada${rodadaAtualServer}_${uid}`;
      const decisaoRef = doc(db, "decisoes", decisaoId);
      const jaTem = await getDoc(decisaoRef);
      if (jaTem.exists()) {
        setMensagemCapitao("🔒 Esta equipe já enviou a decisão desta rodada.");
        return;
      }

      const dados = {
        produto: produtoOpcoes[produtoIndex],
        marketing: marketingOpcoes[marketingIndex],
        capacidade,
        equipe: equipeOpcoes[equipeIndex],
        marca: marcaProtegida,
        beneficio: beneficioOpcoes[beneficioIndex],

        preco, // << selecionado

        totalUsado,
        caixaRestante,
        publicoAlvo,

        // preview (sem concorrência)
        ea: resultado.ea ?? 0,
        share: resultado.share ?? 0,
        demanda: resultado.demanda ?? 0,
        receita: resultado.receita ?? 0,
        custo: resultado.custo ?? 0,
        lucro: resultado.lucro ?? 0,
        reinvestimento: resultado.reinvestimento ?? 0,
        caixaFinal: resultado.caixaFinal ?? 0,
        satisfacao: resultado.satisfacao ?? 0,

        // extras
        vendasPreview: vendasEstimadas,
        marketSizeUsado: marketSize,
        orcamentoUsado: orcamentoRodada,

        timestamp: new Date(),
        codigoTurma,
        uid,
        timeId,
        status: "✅",
      };

      // grava em "decisoes"
      await setDoc(decisaoRef, dados);

      // grava sub da rodada (auditoria)
      await setDoc(doc(db, "rodadas", codigoTurma, `rodada${rodadaAtualServer}`, uid), {
        timeId,
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
        marketSizeUsado: marketSize,
      });

      // espelho flat opcional
      await setDoc(doc(db, "rodadas", `${codigoTurma}_rodada${rodadaAtualServer}_${uid}`), dados);

      setMensagemCapitao("✅ Decisão salva com sucesso!");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err) {
      console.error("Erro ao salvar decisão:", err);
      setMensagemCapitao("❌ Erro ao salvar decisão. Tente novamente.");
    }
  };

  return (
    <div className="decision-container">
      <h2>📊 Decisões Estratégicas</h2>

      <p style={{ marginTop: 4, color: "#666" }}>
        🧮 Mercado desta rodada: {marketSize.toLocaleString("pt-BR")} consumidores
      </p>
      <p style={{ marginTop: 2, color: "#444" }}>
        💼 Orçamento disponível: R$ {orcamentoRodada.toLocaleString("pt-BR")}
      </p>

      {/* PREÇO (mantendo estrutura: label + select) */}
      <div className="decision-block">
        <label>💵 Preço:</label>
        <select value={preco} onChange={(e) => setPreco(Number(e.target.value))}>
          {opcoesPreco.map((p) => (
            <option key={p} value={p}>
              R$ {p}
            </option>
          ))}
        </select>
      </div>

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
        <p>
          📈 <span
            style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={() => window.alert("Efeito de atratividade: representa o quanto sua oferta é atrativa para o público-alvo.")}
          >
            EA
          </span>: {resultado.ea}
        </p>

        {rodadaAtual > 1 ? (
          <p>
            📊 <span
              style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
              onClick={() => window.alert("Share: fatia de mercado conquistada pela sua empresa nesta rodada.")}
            >
              Share
            </span>: {resultado.share}%
          </p>
        ) : (
          <p className="indicator-note">📊 Share será exibido a partir da segunda rodada.</p>
        )}

        <p>
          🛍️ <span
            style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={() => window.alert("Estimativa de vendas nesta rodada (limitada por sua capacidade e tamanho de mercado).")}
          >
            Vendas (estimadas)
          </span>: {formatar(vendasEstimadas)}
        </p>

        <p>
          💰 <span
            style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={() => window.alert("Valor estimado de receita nesta rodada.")}
          >
            Receita
          </span>: R$ {formatar(resultado.receita)}
        </p>

        <p>
          📉 <span
            style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={() => window.alert("Potencial de lucro para essa rodada.")}
          >
            Lucro
          </span>: R$ {formatar(resultado.lucro)}
        </p>

        <p>
          🏦 <span
            style={{ fontWeight: "bold", cursor: "pointer", textDecoration: "underline dotted" }}
            onClick={() => window.alert("Saldo estimado após custos e reinvestimento.")}
          >
            Caixa Final
          </span>: R$ {formatar(resultado.caixaFinal)}
        </p>
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

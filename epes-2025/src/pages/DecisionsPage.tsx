import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { calcularRodadaPreview } from "../services/calcularRodadas";
import { useNavigate } from "react-router-dom";


import "./DecisionPage.css";

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0e2a47 0%, #0a1e31 45%, #121212 100%)",
    color: "#eaf2f8",
  } as React.CSSProperties,
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px 24px 56px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0 24px",
  } as React.CSSProperties,
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  titleBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "#9fd3ff",
    background: "rgba(159, 211, 255, 0.12)",
    border: "1px solid rgba(159,211,255,0.25)",
  } as React.CSSProperties,
  h1: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: 0.2 } as React.CSSProperties,
  glassCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(7px)",
    WebkitBackdropFilter: "blur(7px)",
    borderRadius: 16,
  } as React.CSSProperties,
  section: { padding: 16, marginTop: 12 } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 12,
  } as React.CSSProperties,
  label: { display: "block", fontSize: 13, marginBottom: 6, opacity: 0.9 } as React.CSSProperties,
  select: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
  } as React.CSSProperties,
  pillBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf2f8",
    padding: "12px 18px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  } as React.CSSProperties,
  indicators: { padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12 } as React.CSSProperties,
  small: { color: "#cbe3ff", marginTop: 4 } as React.CSSProperties,
};

const DEBUG = (import.meta as any)?.env?.VITE_DEBUG === "true"; // defina VITE_DEBUG=true para exibir o painel
const dlog = (...args: any[]) => {
  if (DEBUG) console.debug("[DecisionsPage]", ...args);
};

export default function DecisionPage() {
  const navigate = useNavigate();
  dlog("mount: entrando na tela de decisões");
  // ---- helpers para mapear opções para valores ----
  const mapProdutoToQualidade = (s: string) => ({"Básico":10, "Intermediário":20, "Avançado":35, "Premium":50}[s] ?? 10);
  const mapMarketingToBonus = (s: string) => ({"Local":8, "Regional":15, "Nacional":25, "Nacional + Influenciadores":35}[s] ?? 8);
  const mapCapacidadeToValue = (s: string) => ({"500 unidades":500, "1.000 unidades":1000, "2.000 unidades":2000, "3.000 unidades":3000}[s] ?? 500);
  const mapEquipeToBonus = (s: string) => ({"Enxuto":5, "Balanceado":15, "Reforçado":25, "Especializado":30}[s] ?? 5);
  const mapBeneficioToBonus = (s: string) => ({"Cupom":10, "Brinde":15, "Frete grátis":20, "Nenhum":0}[s] ?? 0);

  type EquipeInput = {
    id: string;
    preco: number;
    qualidade: number;
    marketingBonus: number;
    equipeBonus: number;
    beneficioBonus: number;
    capacidade: number;
    publicoAlvo: string;
    caixaAcumulado: number;
  };

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
  // UI error flag for auth/capitao
  const [uiError, setUiError] = useState<string | null>(null);

  const codigoTurma = localStorage.getItem("codigoTurma") ?? "";
  const timeIdLS = localStorage.getItem("idDoTime") ?? "";
  // ---- peers (decisões das outras equipes da mesma rodada) ----
  const [peerEquipes, setPeerEquipes] = useState<EquipeInput[]>([]);
  useEffect(() => {
    const carregarPeers = async () => {
      try {
        dlog("carregarPeers():", { rodadaAtual, codigoTurma });
        if (!rodadaAtual || !codigoTurma) return;
        // busca decisões da rodada atual (de todos os times)
        const q = query(collection(db, "decisoes"), where("rodada", "==", rodadaAtual));
        const snap = await getDocs(q);
        dlog("peers encontrados:", snap.size);
        const arr: EquipeInput[] = [];
        snap.forEach((d) => {
          const x: any = d.data();
          // ignorar este time (vamos adicionar a versão local dele abaixo)
          if (x?.timeId && x.timeId === timeIdLS) return;
          const produtoStr = String(x?.produtoNivel ?? x?.produto ?? "Básico");
          const marketingStr = String(x?.marketingPacote ?? x?.marketing ?? "Local");
          const equipeStr = String(x?.equipeNivel ?? x?.equipe ?? "Enxuto");
          const beneficioStr = String(x?.beneficio ?? "Nenhum");
          const capacidadeStr = String(x?.capacidadeNivel ?? x?.capacidade ?? "500 unidades");

          const e: EquipeInput = {
            id: String(x?.timeId ?? x?.codigoTurma ?? d.id),
            preco: Number(x?.preco ?? 100),
            qualidade: mapProdutoToQualidade(produtoStr),
            marketingBonus: mapMarketingToBonus(marketingStr),
            equipeBonus: mapEquipeToBonus(equipeStr),
            beneficioBonus: mapBeneficioToBonus(beneficioStr),
            capacidade: mapCapacidadeToValue(capacidadeStr),
            publicoAlvo: String(x?.publicoAlvo ?? "Adultos (25–40 anos)"),
            caixaAcumulado: Number(x?.caixaFinal ?? 0),
          };
          arr.push(e);
        });
        setPeerEquipes(arr);
        dlog("peerEquipes set", arr.length);
      } catch (e) {
        dlog("peers erro", e);
        setPeerEquipes([]);
      }
    };
    carregarPeers();
  }, [rodadaAtual, codigoTurma, timeIdLS]);


  // --------- auth + capitao ---------
  useEffect(() => {
    if (!auth) return;
    dlog("auth guard: auth indisponível?", !auth);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      try {
        dlog("auth state change: user?", !!user?.uid);
        if (user?.uid) {
          setUid(user.uid);
          if (!codigoTurma) return;

          const timeRef = doc(db, "times", codigoTurma);
          const timeSnap = await getDoc(timeRef);
          const timeData: any = timeSnap.data();
          dlog("timeData carregado", { id: codigoTurma, temMembros: Array.isArray(timeData?.membros), criadoPor: timeData?.criadoPor });

          const isOwner = timeData?.criadoPor === user.uid;
          const isMemberCaptain = Array.isArray(timeData?.membros)
            ? timeData.membros.some(
                (m: any) =>
                  m?.uid === user.uid &&
                  m?.status === "aprovado" &&
                  (m?.role === "capitao" || m?.isCapitao === true)
              )
            : false;
          dlog("isOwner/isMemberCaptain", { isOwner, isMemberCaptain });

          setIsCapitao(!!(isOwner || isMemberCaptain));
        }
      } catch (e) {
        console.error("auth/onAuthStateChanged error:", e);
        dlog("auth error", e);
        setUiError("Falha ao carregar permissões do time. Recarregue a página.");
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
      dlog("carregar(): empresa/config", { codigoTurma });
      // Preferir empresa pelo timeIdLS (ou fallback para codigoTurma)
      const empresaRef = doc(db, "empresas", timeIdLS || codigoTurma);
      const geralRef = doc(db, "configuracoes", "geral");

      const [empresaSnap, geralSnap] = await Promise.all([getDoc(empresaRef), getDoc(geralRef)]);
      const empresaData: any = empresaSnap.data();
      const geralData: any = geralSnap.data();

      if (empresaData?.publicoAlvo) setPublicoAlvo(empresaData.publicoAlvo);
      if (empresaData?.membros) setMembros(empresaData.membros);

      setRodadaAtiva(geralData?.rodadaAtiva === true);
      setRodadaAtual(geralData?.rodadaAtual ?? 1);

      // ================== Defaults vindos da rodada anterior (se existir) ==================
      try {
        const turmaId = codigoTurma;
        const timeId = timeIdLS || localStorage.getItem("idDoTime") || "";
        const rodadaAtualServer = Number(geralData?.rodadaAtual ?? 1);
        const rodadaAnterior = rodadaAtualServer - 1;

        if (turmaId && timeId && rodadaAnterior >= 1) {
          const decisaoPrevId = `${turmaId}_${timeId}_r${rodadaAnterior}`;
          const decisaoPrevRef = doc(db, "decisoes", decisaoPrevId);
          const decisaoPrevSnap = await getDoc(decisaoPrevRef);

          if (decisaoPrevSnap.exists()) {
            const prev: any = decisaoPrevSnap.data();

            // helpers de index seguro
            const safeIndex = (arr: string[], value: string, fallbackIdx = 0) => {
              const idx = arr.indexOf(String(value));
              return idx >= 0 ? idx : fallbackIdx;
            };

            // Mapeia strings salvas para os índices locais dos selects
            if (typeof prev.preco === "number") setPreco(Number(prev.preco));

            const pIdx = safeIndex(
              ["Básico", "Intermediário", "Avançado", "Premium"],
              prev.produtoNivel ?? prev.produto
            );
            setProdutoIndex(pIdx);

            const mIdx = safeIndex(
              ["Local", "Regional", "Nacional", "Nacional + Influenciadores"],
              prev.marketingPacote ?? prev.marketing
            );
            setMarketingIndex(mIdx);

            const cIdx = safeIndex(
              ["500 unidades", "1.000 unidades", "2.000 unidades", "3.000 unidades"],
              prev.capacidadeNivel ?? prev.capacidade
            );
            setCapacidadeIndex(cIdx);

            const eIdx = safeIndex(
              ["Enxuto", "Balanceado", "Reforçado", "Especializado"],
              prev.equipeNivel ?? prev.equipe
            );
            setEquipeIndex(eIdx);

            const bIdx = safeIndex(
              ["Cupom", "Brinde", "Frete grátis", "Nenhum"],
              prev.beneficio
            );
            setBeneficioIndex(bIdx);

            if (typeof prev.marcaProtegida === "boolean") setMarcaProtegida(prev.marcaProtegida);
            if (typeof prev.publicoAlvo === "string" && prev.publicoAlvo.trim() !== "") {
              setPublicoAlvo(prev.publicoAlvo);
            }

            dlog("defaults carregados da rodada anterior", {
              rodadaAnterior,
              preco: prev.preco,
              produtoNivel: prev.produtoNivel,
              marketingPacote: prev.marketingPacote,
              capacidadeNivel: prev.capacidadeNivel,
              equipeNivel: prev.equipeNivel,
              beneficio: prev.beneficio,
              marcaProtegida: prev.marcaProtegida,
              publicoAlvo: prev.publicoAlvo,
            });
          } else {
            dlog("nenhuma decisão anterior encontrada para defaults", { rodadaAnterior });
          }
        }
      } catch (e) {
        console.warn("Falha ao carregar defaults da rodada anterior:", e);
      }
      // =====================================================================================

      // ================== Orçamento dinâmico: 500k + 20% do lucro das rodadas anteriores ==================
      try {
        const turmaId = codigoTurma;
        const timeId = timeIdLS || localStorage.getItem("idDoTime") || "";
        const rodadaAtualServer = Number(geralData?.rodadaAtual ?? 1);

        let somaCarry = 0;
        if (turmaId && timeId && rodadaAtualServer > 1) {
          for (let r = 1; r < rodadaAtualServer; r++) {
            const ref = doc(db, "resultadosOficiais", turmaId, `rodada_${r}`, timeId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const d: any = snap.data();
              const lucro = Number(d?.lucro ?? 0);
              // se já tiver persistentemente o reinvestimento salvo, use-o; senão, 20% do lucro
              const reinvest = Number.isFinite(d?.reinvestimento) ? Number(d.reinvestimento) : Math.max(0, Math.round(lucro * 0.20));
              if (Number.isFinite(reinvest) && reinvest > 0) somaCarry += reinvest;
            }
          }
        }
        setOrcamentoRodada(500000 + somaCarry);
      } catch (e) {
        // fallback conservador se algo falhar
        setOrcamentoRodada(500000);
      }
      // ============================================================================================

      // Preferir market size específico da rodada (configuracoes/geral/rodadas/rodada_{N})
      try {
        const rodadaN = Number(geralData?.rodadaAtual ?? 1);
        const rodadaRef = doc(db, "configuracoes", "geral", "rodadas", `rodada_${rodadaN}`);
        const rodadaSnap = await getDoc(rodadaRef);
        if (rodadaSnap.exists()) {
          const rdata: any = rodadaSnap.data();
          const msRodada = Number(rdata?.marketSize);
          if (Number.isFinite(msRodada) && msRodada > 0) {
            setMarketSize(msRodada);
          } else {
            setMarketSize(typeof geralData?.marketSize === "number" ? Number(geralData.marketSize) : 10000);
          }
        } else {
          setMarketSize(typeof geralData?.marketSize === "number" ? Number(geralData.marketSize) : 10000);
        }
      } catch (e) {
        // fallback em caso de falha
        setMarketSize(typeof geralData?.marketSize === "number" ? Number(geralData.marketSize) : 10000);
      }
      dlog("config geral", { rodadaAtiva: geralData?.rodadaAtiva, rodadaAtual: geralData?.rodadaAtual, marketSize: geralData?.marketSize });

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

  // --------- PREVIEW competitivo ----------
  const resultado = useMemo(() => {
    dlog("preview inputs:", { timeIdLS, codigoTurma, preco, qualidade, marketingBonus, equipeBonus, beneficioBonus, capacidade, publicoAlvo, marketSize, peers: peerEquipes.length });
    try {
      const myTeam: EquipeInput = {
        id: timeIdLS || codigoTurma || "local",
        preco,
        qualidade,
        marketingBonus,
        equipeBonus,
        beneficioBonus,
        capacidade,
        publicoAlvo,
        caixaAcumulado: 0,
      };

      const todas: EquipeInput[] = [...peerEquipes, myTeam];

      const prev = calcularRodadaPreview(
        // @ts-ignore – forma estruturalmente equivalente
        todas,
        myTeam.id,
        { refPrice: 100, marketSize, beta: 1.1, shareCap: 0.55, fixedTeamCost: 5000, reinvestRate: 0.2 }
      );
      dlog("preview calculado", prev);
      return (
        prev ?? {
          ea: 0,
          demanda: 0,
          receita: 0,
          custo: 0,
          lucro: 0,
          reinvestimento: 0,
          caixaFinal: 0,
          cvu: 0,
          backlog: false,
          satisfacao: 0,
          share: 0,
        }
      );
    } catch (e) {
      dlog("preview catch", e);
      console.error("Erro no preview competitivo:", e);
      return {
        ea: 0,
        demanda: 0,
        receita: 0,
        custo: 0,
        lucro: 0,
        reinvestimento: 0,
        caixaFinal: 0,
        cvu: 0,
        backlog: false,
        satisfacao: 0,
        share: 0,
      };
    }
  }, [timeIdLS, codigoTurma, preco, qualidade, marketingBonus, equipeBonus, beneficioBonus, capacidade, publicoAlvo, marketSize, peerEquipes]);

  const vendasEstimadas = useMemo(() => {
    const demanda = Number.isFinite(resultado.demanda) ? resultado.demanda : 0;
    return Math.min(demanda, capacidade, marketSize);
  }, [resultado.demanda, capacidade, marketSize]);

  // --------- salvar decisão ----------
  const salvarDecisao = async () => {
    dlog("salvarDecisao(): start");
    try {
      const timeId = localStorage.getItem("idDoTime");

      const geralRef = doc(db, "configuracoes", "geral");
      const geralSnap = await getDoc(geralRef);
      const rodadaAtualServer = geralSnap.data()?.rodadaAtual ?? 1;

      if (!isCapitao) {
        dlog("guards", { isCapitao, rodadaAtiva, passouDoLimite, uid, codigoTurma, timeId });
        setMensagemCapitao("🔒 Apenas o capitão pode enviar a decisão final.");
        return;
      }
      if (!rodadaAtiva || passouDoLimite) {
        dlog("guards", { isCapitao, rodadaAtiva, passouDoLimite, uid, codigoTurma, timeId });
        return;
      }

      if (!uid || !codigoTurma || !timeId || uid.trim() === "" || timeId.trim() === "") {
        dlog("guards", { isCapitao, rodadaAtiva, passouDoLimite, uid, codigoTurma, timeId });
        setMensagemCapitao("⚠️ Informações incompletas. Verifique login e se você escolheu um time.");
        return;
      }

      // 1 por rodada (por time)
      const decisaoId = `${codigoTurma}_${timeId}_r${rodadaAtualServer}`;
      const decisaoRef = doc(db, "decisoes", decisaoId);
      const jaTem = await getDoc(decisaoRef);
      if (jaTem.exists()) {
        setMensagemCapitao("🔒 Esta equipe já enviou a decisão desta rodada.");
        return;
      }

      const dados = {
        turmaId: codigoTurma,
        timeId,
        rodada: rodadaAtualServer,
        // inputs discretos
        preco,
        produtoNivel: produtoOpcoes[produtoIndex],
        marketingPacote: marketingOpcoes[marketingIndex],
        capacidadeNivel: capacidadeOpcoes[capacidadeIndex],
        equipeNivel: equipeOpcoes[equipeIndex],
        beneficio: beneficioOpcoes[beneficioIndex],
        marcaProtegida: marcaProtegida,
        publicoAlvo,
        // meta
        atualizadoPor: uid,
        timestamp: new Date(),
        status: "✅",
      };

      // grava em "decisoes"
      await setDoc(decisaoRef, dados);

      dlog("decisao salva", { decisaoId, rodadaAtualServer });
      setMensagemCapitao("✅ Decisão salva com sucesso!");
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err) {
      console.error("Erro ao salvar decisão:", err);
      setMensagemCapitao("❌ Erro ao salvar decisão. Tente novamente.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.titleWrap}>
            <span style={styles.titleBadge}>EPES • Challenge 2025</span>
            <h1 style={styles.h1}>Decisões Estratégicas</h1>
          </div>
        </header>
        {DEBUG && (
          <details style={{ marginBottom: 8 }} open>
            <summary style={{ cursor: "pointer", userSelect: "none" }}>🔧 Debug (ocultar/mostrar)</summary>
            <pre style={{
              background: "#0b0b0b",
              color: "#9ef",
              padding: 8,
              borderRadius: 6,
              fontSize: 11,
              overflow: "auto",
              maxHeight: 200,
              marginTop: 6,
              border: "1px solid #223"
            }}>
{JSON.stringify({ rodadaAtiva, rodadaAtual, codigoTurma, timeIdLS, peers: peerEquipes.length, resultado }, null, 2)}
            </pre>
          </details>
        )}
        <div style={{ ...styles.glassCard, ...styles.section }}>
          <p style={{ margin: 0 }}>
            🧮 Mercado desta rodada: <strong>{marketSize.toLocaleString("pt-BR")}</strong> consumidores
          </p>
          <p style={{ margin: "6px 0 0" }}>
            💼 Orçamento disponível: <strong>R$ {orcamentoRodada.toLocaleString("pt-BR")}</strong>
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <strong>💸 Total usado:</strong> R$ {formatar(totalUsado)}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <strong>🧮 Caixa restante:</strong> R$ {formatar(caixaRestante)}
          </p>
        </div>
        <div style={styles.grid}>
          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>💵 Preço</label>
            <select value={preco} onChange={(e) => setPreco(Number(e.target.value))} style={styles.select}>
              {opcoesPreco.map((p) => (
                <option key={p} value={p}>R$ {p}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>🔬 Produto & P&D</label>
            <select value={produtoIndex} onChange={(e) => setProdutoIndex(Number(e.target.value))} style={styles.select}>
              {produtoOpcoes.map((op, i) => (
                <option key={i} value={i}>{op}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>📢 Marketing & Branding</label>
            <select value={marketingIndex} onChange={(e) => setMarketingIndex(Number(e.target.value))} style={styles.select}>
              {marketingOpcoes.map((op, i) => (
                <option key={i} value={i}>{op}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>🏭 Capacidade Operacional</label>
            <select value={capacidadeIndex} onChange={(e) => setCapacidadeIndex(Number(e.target.value))} style={styles.select}>
              {capacidadeOpcoes.map((op, i) => (
                <option key={i} value={i}>{op}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>👥 Equipe & Treinamento</label>
            <select value={equipeIndex} onChange={(e) => setEquipeIndex(Number(e.target.value))} style={styles.select}>
              {equipeOpcoes.map((op, i) => (
                <option key={i} value={i}>{op}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>🛡️ Proteção de Marca</label>
            <select value={marcaProtegida ? "sim" : "nao"} onChange={(e) => setMarcaProtegida(e.target.value === "sim")} style={styles.select}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>

          <div style={{ ...styles.glassCard, ...styles.section }}>
            <label style={styles.label}>🎁 Benefício de Lançamento</label>
            <select value={beneficioIndex} onChange={(e) => setBeneficioIndex(Number(e.target.value))} style={styles.select}>
              {beneficioOpcoes.map((op, i) => (
                <option key={i} value={i}>{op}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ ...styles.glassCard, ...styles.section, marginTop: 12 }}>
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
          {uiError && (
            <div className="alert red">{uiError}</div>
          )}
        </div>
        <div style={{ ...styles.glassCard, ...styles.section, marginTop: 12 }}>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <button
              style={styles.pillBtn}
              disabled={!rodadaAtiva || passouDoLimite}
              onClick={salvarDecisao}
              title={!rodadaAtiva ? "Rodada fechada" : passouDoLimite ? "Ajuste o orçamento" : "Salvar"}
            >
              💾 Salvar Decisão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

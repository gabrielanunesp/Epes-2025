// src/pages/PainelResponsavel.tsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ConfirmacaoExclusao from "../components/ConfirmacaoExclusao";
import { fecharRodadaLocal as fecharRodadaService } from "../services/fechamentoLocal";

// ===================== STYLES =====================
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
    overflow: "hidden",           // evita o “vazamento” visual
    boxSizing: "border-box",
    position: "relative",
  } as React.CSSProperties,
  cardBody: {
    padding: "18px 16px 20px",    // padding extra embaixo
  } as React.CSSProperties,

  identity: {
    display: "grid",
    gridTemplateColumns: "72px 1fr auto",
    gap: 16,
    padding: 16,
    alignItems: "center",
  } as React.CSSProperties,
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,0.18)",
  } as React.CSSProperties,
  quickRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  } as React.CSSProperties,
  pillBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf2f8",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  // 👉 coluna mínima 320px evita card estreito que “empurra” conteúdo para fora
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
    marginTop: 24,
  } as React.CSSProperties,

  callout: { padding: 18, lineHeight: 1.65 } as React.CSSProperties,
  calloutTitle: { margin: 0, fontSize: 18, fontWeight: 700 } as React.CSSProperties,

  formBox: {
    padding: 16,
    marginTop: 16,
  } as React.CSSProperties,
  formLabel: {
    display: "block",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 6,
    opacity: 0.9,
  } as React.CSSProperties,
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
    lineHeight: 1.2,
  } as React.CSSProperties,
  select: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
    height: 40,
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
    lineHeight: 1.2,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 90,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
    lineHeight: 1.4,
  } as React.CSSProperties,

  sectionTitle: { margin: "22px 0 8px", fontSize: 18, fontWeight: 800 } as React.CSSProperties,
  sectionTitleTight: { margin: "0 0 12px", fontSize: 18, fontWeight: 800 } as React.CSSProperties,

  footerHint: { opacity: 0.8, fontSize: 12, marginTop: 24 } as React.CSSProperties,
};

// Helpers de variantes visuais
const btnVariant = (hex: string): React.CSSProperties => ({
  ...styles.pillBtn,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${hex}80`,
  boxShadow: `0 0 0 1px ${hex}2a inset`,
});
const tagVariant = (hex: string): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  letterSpacing: 0.3,
  color: "#eaf2f8",
  background: `${hex}1f`,
  border: `1px solid ${hex}55`,
});

// ===================== DEBUG LOGS =====================
const debug = true;
const dlog = (...args: any[]) => { if (debug) console.log(...args); };
const derr = (...args: any[]) => { if (debug) console.error(...args); };
const dtable = (data: any) => { if (debug && Array.isArray(data)) console.table(data); };

// ---------- helpers para market size randômico por rodada ----------
const uniformInt = (min: number, max: number) => {
  const a = Math.ceil(min), b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
};
const normalInt = (mean: number, std: number, clampMin: number, clampMax: number) => {
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const x = Math.round(mean + std * z);
  return Math.max(clampMin, Math.min(clampMax, x));
};

async function gerarEGravarMarketSizeDaRodada(rodada: number) {
  const geralRef = doc(db, "configuracoes", "geral");
  const geralSnap = await getDoc(geralRef);
  const g = geralSnap.data() || {};

  const dist: string = g.marketDist || "uniform";
  const min = Number(g.marketMin ?? 1600);
  const max = Number(g.marketMax ?? 2400);
  const mean = Number(g.marketMean ?? 2000);
  const std = Number(g.marketStd ?? 200);

  let marketSize: number;
  if (dist === "normal") marketSize = normalInt(mean, std, min, max);
  else marketSize = uniformInt(min, max);

  const rodadaDocRef = doc(db, "configuracoes", "geral", "rodadas", `rodada_${rodada}`);
  try {
    await setDoc(
      rodadaDocRef,
      {
        marketSize, dist, min, max, mean, std,
        seed: `global-rodada-${rodada}-${new Date().toISOString()}`,
        createdAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error("[ABRIR] Falha ao gravar marketSize da rodada:", {
      path: `configuracoes/geral/rodadas/rodada_${rodada}`,
      error: { code: err?.code, name: err?.name, message: err?.message, stack: err?.stack },
    });
    throw new Error(
      `Falha ao gravar marketSize da rodada ${rodada}: ${err?.code || ""} ${err?.message || ""}`.trim()
    );
  }

  dlog("[ABRIR] rodada:", rodada, "marketSize sorteado:", marketSize, { dist, min, max, mean, std });
  return marketSize;
}

export default function PainelResponsavel() {
  // --- estado principal ---
  const [times, setTimes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // filtros/lista
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");

  // exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<any>(null);
  const [tipoExclusao, setTipoExclusao] = useState<"time" | "membro" | null>(null);
  const [timeOrigem, setTimeOrigem] = useState<string | undefined>(undefined);

  // controle de rodada
  const [rodadaAtual, setRodadaAtual] = useState<number>(1);
  const [rodadaAtiva, setRodadaAtiva] = useState<boolean>(false);
  const [prazo, setPrazo] = useState<Date | null>(null);
  const [marketSizeRodada, setMarketSizeRodada] = useState<number | null>(null);
  // parâmetros de mercado
  const [marketDist, setMarketDist] = useState<string>("uniform");
  const [marketMin, setMarketMin] = useState<number>(1600);
  const [marketMax, setMarketMax] = useState<number>(2400);
  const [marketMean, setMarketMean] = useState<number>(2000);
  const [marketStd, setMarketStd] = useState<number>(200);

  // input do ADM
  const [inputRodada, setInputRodada] = useState<number>(1);

  const navigate = useNavigate();

  // ---------- helpers ----------
  const fmtDateTime = (d?: Date | null) => {
    if (!d) return "—";
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(d);
    } catch {
      return d.toString();
    }
  };
  const endOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  };

  // ---------- permissão + carga inicial ----------
  useEffect(() => {
    const verificarPermissao = async () => {
      const user = auth.currentUser;
      dlog("[UI] verificarPermissao: currentUser:", user?.uid || null);
      if (!user) { navigate("/login"); return; }

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);
      const dados = snapshot.data();
      dlog("[UI] user doc:", dados);

      if (dados?.papel !== "responsavel") {
        dlog("[UI] bloqueado: papel != responsavel", dados?.papel);
        navigate("/dashboard");
        return;
      }

      dlog("[UI] carregando times + head...");
      await Promise.all([carregarTimes(), carregarHead()]);
      setCarregando(false);
      dlog("[UI] carga inicial concluída");
    };

    verificarPermissao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ---------- leitura de cabeçalho ----------
  const carregarHead = async () => {
    dlog("[UI] carregarHead()");
    const geralRef = doc(db, "configuracoes", "geral");
    const snap = await getDoc(geralRef);
    const g = snap.data() || {};
    const rAtiva = !!g.rodadaAtiva;
    const rAtual = Number(g.rodadaAtual ?? 1);
    dlog("[UI] head:", { rodadaAtiva: rAtiva, rodadaAtual: rAtual, prazo: g?.prazo });

    setRodadaAtiva(rAtiva);
    setRodadaAtual(rAtual);
    setInputRodada(rAtual);

    setMarketDist(String(g.marketDist || "uniform"));
    setMarketMin(Number(g.marketMin ?? 1600));
    setMarketMax(Number(g.marketMax ?? 2400));
    setMarketMean(Number(g.marketMean ?? 2000));
    setMarketStd(Number(g.marketStd ?? 200));

    try {
      const rodadaRef = doc(db, "configuracoes", "geral", "rodadas", `rodada_${rAtual}`);
      const rodadaSnap = await getDoc(rodadaRef);
      const rdata = rodadaSnap.data();
      const ms = rdata?.marketSize;
      setMarketSizeRodada(typeof ms === "number" ? ms : null);
      dlog("[UI] marketSizeRodada (head):", ms ?? "—");
    } catch (e) {
      setMarketSizeRodada(null);
      console.warn("[UI] não foi possível ler marketSize da rodada:", e);
    }

    if (g.prazo?.seconds) setPrazo(new Date(g.prazo.seconds * 1000));
    else if (g.prazo instanceof Date) setPrazo(g.prazo);
    else setPrazo(null);
  };

  // ---------- salvar parâmetros de mercado ----------
  const salvarParametrosMercado = async () => {
    try {
      const geralRef = doc(db, "configuracoes", "geral");
      await setDoc(
        geralRef,
        {
          marketDist,
          marketMin: Number(marketMin),
          marketMax: Number(marketMax),
          marketMean: Number(marketMean),
          marketStd: Number(marketStd),
        },
        { merge: true }
      );
      alert("✅ Parâmetros de mercado salvos!");
    } catch (e) {
      console.error("Erro ao salvar parâmetros de mercado:", e);
      alert("❌ Erro ao salvar parâmetros de mercado. Veja o console.");
    }
  };

  // ---------- leitura de times ----------
  const carregarTimes = async () => {
    dlog("[UI] carregarTimes()");
    const timesSnapshot = await getDocs(collection(db, "times"));
    const lista = timesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    dlog("[UI] times carregados:", lista.length);
    dtable(lista.map((t) => ({ id: (t as any).id, nome: (t as any).nome, turmaId: (t as any).turmaId, membros: (t as any).membros?.length || 0 })));
    setTimes(lista);
  };

  // ---------- limpar coleções (reset) ----------
  const limparColecoes = async () => {
    const colecoes = ["decisoes", "jogadores", "times", "controleRodada", "empresas", "resultadosOficiais"];
    for (const nome of colecoes) {
      const snapshot = await getDocs(collection(db, nome));
      const deletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletes);
    }

    const rodadasRootSnap = await getDocs(collection(db, "rodadas"));
    for (const turmaDoc of rodadasRootSnap.docs) {
      const turmaId = turmaDoc.id;
      for (let i = 1; i <= 10; i++) {
        const sub = collection(db, "rodadas", turmaId, `rodada${i}`);
        const subSnap = await getDocs(sub);
        const subDeletes = subSnap.docs.map((s) => deleteDoc(s.ref));
        await Promise.all(subDeletes);
      }
      await deleteDoc(doc(db, "rodadas", turmaId));
    }
  };

  // ---------- aprovação/exclusão ----------
  const aprovarMembro = async (timeId: string, membroUid: string) => {
    const timeRef = doc(db, "times", timeId);
    const snapshot = await getDoc(timeRef);
    const dados = snapshot.data();
    if (!dados || !Array.isArray(dados.membros)) return;

    const novosMembros = dados.membros.map((m: any) => (m.uid === membroUid ? { ...m, status: "aprovado" } : m));
    await updateDoc(timeRef, { membros: novosMembros });
    setTimes((prev) => prev.map((t) => (t.id === timeId ? { ...t, membros: novosMembros } : t)));
  };

  const solicitarExclusaoTime = (time: any) => {
    setItemParaExcluir(time);
    setTipoExclusao("time");
    setTimeOrigem(undefined);
  };
  const solicitarExclusaoMembro = (timeId: string, membro: any) => {
    setItemParaExcluir(membro);
    setTipoExclusao("membro");
    setTimeOrigem(timeId);
  };

  // ---------- filtro da lista ----------
  const filtrarMembros = (membros: any[]) => {
    return membros.filter((m) => {
      const nomeMatch = (m.nome || "").toLowerCase().includes(busca.toLowerCase());
      const emailMatch = (m.email || "").toLowerCase().includes(busca.toLowerCase());
      const statusMatch = filtro === "todos" || m.status === filtro;
      return (nomeMatch || emailMatch) && statusMatch;
    });
  };

  // ---------- estatísticas topo ----------
  const totalPendentes = times.reduce((acc, t) => acc + (t.membros?.filter((m: any) => m.status === "pending").length || 0), 0);
  const totalAprovados = times.reduce((acc, t) => acc + (t.membros?.filter((m: any) => m.status === "aprovado").length || 0), 0);
  const totalJogadores = times.reduce((acc, t) => acc + (t.membros?.length || 0), 0);

  // ---------- iniciar rodada ----------
  const iniciarRodada = async () => {
    try {
      dlog("[UI] iniciarRodada", { inputRodada });
      if (!inputRodada || inputRodada < 1) { alert("Informe um número de rodada válido."); return; }
      const prazoHoje = endOfToday();
      const geralRef = doc(db, "configuracoes", "geral");

      try {
        console.time("iniciarRodada.setHeader");
        await setDoc(geralRef, { rodadaAtual: inputRodada, rodadaAtiva: true, prazo: prazoHoje }, { merge: true });
        console.timeEnd("iniciarRodada.setHeader");
      } catch (err: any) {
        console.error("❌ Falha ao atualizar config/geral:", { path: "configuracoes/geral", error: { code: err?.code, name: err?.name, message: err?.message, stack: err?.stack } });
        alert(`❌ Erro ao atualizar 'configuracoes/geral': ${err?.code || ""} ${err?.message || ""}`.trim());
        return;
      }

      let ms: number;
      try {
        console.time("iniciarRodada.gerarMarketSize");
        ms = await gerarEGravarMarketSizeDaRodada(inputRodada);
        console.timeEnd("iniciarRodada.gerarMarketSize");
      } catch (err: any) {
        console.error("❌ Falha ao gerar/gravar Market Size:", { rodada: inputRodada, error: { code: err?.code, name: err?.name, message: err?.message, stack: err?.stack } });
        alert(`❌ Erro ao gravar Market Size da rodada ${inputRodada}: ${err?.code || ""} ${err?.message || ""}`.trim());
        return;
      }

      setRodadaAtual(inputRodada);
      setRodadaAtiva(true);
      setPrazo(prazoHoje);
      setMarketSizeRodada(ms);

      alert(`🚀 Rodada ${inputRodada} iniciada!\n📈 Market Size sorteado: ${ms}`);
    } catch (e: any) {
      derr("Erro ao iniciar rodada (bloco externo):", e);
      alert(`❌ Erro ao iniciar rodada: ${e?.code || ""} ${e?.message || "ver console"}`.trim());
    }
  };

  // ---------- fechar rodada ----------
  const fecharRodadaLocal = async (rodada: number) => {
    console.groupCollapsed("🔒 [UI] Fechar Rodada");
    try {
      dlog("➡️ params:", { rodada });
      console.time("fecharRodadaLocal.total");

      if (!rodada || rodada < 1) { console.warn("[UI] rodada inválida:", rodada); alert("Informe um número de rodada válido."); return; }

      console.time("fecharRodadaLocal.readConfig");
      const geralRef = doc(db, "configuracoes", "geral");
      const geralSnap = await getDoc(geralRef);
      const g = geralSnap.data() || {};
      console.timeEnd("fecharRodadaLocal.readConfig");
      dlog("🧾 config/geral:", g);

      const turmaIdConfig = g.turmaId || g.codigoTurma;
      let turmaIdEfetiva: string | undefined = turmaIdConfig;
      if (!turmaIdEfetiva) {
        console.time("fecharRodadaLocal.findTurmaFromTimes");
        const timesSnap = await getDocs(collection(db, "times"));
        const times = timesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.timeEnd("fecharRodadaLocal.findTurmaFromTimes");
        dtable(times.map((t) => ({ id: (t as any).id, turmaId: (t as any).turmaId })));
        turmaIdEfetiva = (times.find((t) => (t as any).turmaId) as any)?.turmaId || (times[0] as any)?.id;
      }
      dlog("🎯 turmaIdEfetiva:", turmaIdEfetiva);

      if (!turmaIdEfetiva) {
        derr("[UI] Sem turmaIdEfetiva");
        alert("Não foi possível determinar a turma. Configure 'configuracoes/geral.turmaId'.");
        return;
      }

      console.time("fecharRodadaLocal.servico");
      const r = await fecharRodadaService({ turma: turmaIdEfetiva, rodada: Number(inputRodada) });
      console.timeEnd("fecharRodadaLocal.servico");
      dlog("✅ [serviço] retorno:", r);

      console.time("fecharRodadaLocal.atualizaFlag");
      await updateDoc(geralRef, { rodadaAtiva: false });
      console.timeEnd("fecharRodadaLocal.atualizaFlag");
      setRodadaAtiva(false);

      alert(`✅ Rodada ${rodada} fechada com sucesso! Resultados oficiais publicados.`);
    } catch (e: any) {
      derr("❌ Erro no fechamento (serviço):", e);
      derr("name:", e?.name, "message:", e?.message, "stack:", e?.stack);
      alert(`❌ Erro ao fechar rodada: ${e?.message || "ver console"}`);
    } finally {
      console.timeEnd?.("fecharRodadaLocal.total");
      console.groupEnd();
    }
  };

  if (carregando) return (<p style={{ ...styles.callout, opacity: 0.9 }}>🔄 Carregando painel...</p>);

  // ---------- UI ----------
  return (
    <div style={styles.page}>
      {/* CSS escopado: garante dark nos selects/options e corrige box-sizing + wraps */}
      <style>{`
        [data-pr], [data-pr] *, [data-pr] *::before, [data-pr] *::after { box-sizing: border-box; }
        [data-pr] select, [data-pr] option { background: rgba(10, 30, 49, 0.96); color: #eaf2f8; }
        [data-pr] option { background: #0a1e31; color: #eaf2f8; }
        [data-pr] details > summary::-webkit-details-marker { display: none; }
        /* Linhas de ação nunca estouram o card */
        [data-pr] .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; width: 100%; }
        [data-pr] .grid-3 { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0,1fr)); }
        [data-pr] .grid-2 { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0,1fr)); }
        [data-pr] button, [data-pr] input, [data-pr] select { max-width: 100%; }
      `}</style>

      <div style={styles.container} data-pr>
        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.titleWrap}>
            <div style={{ ...styles.titleBadge }}>PAINEL</div>
            <h1 style={styles.h1}>🛡️ Painel do Responsável</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={tagVariant(rodadaAtiva ? "#24d08f" : "#ff5c7a")} title={rodadaAtiva ? "Rodada Ativa" : "Rodada Fechada"}>
              {rodadaAtiva ? "Rodada Ativa" : "Rodada Fechada"}
            </div>
            <div style={styles.titleBadge}>Rodada #{rodadaAtual}</div>
            <button onClick={() => navigate("/dashboard")} style={btnVariant("#4aa3ff")}>
              🧭 Ir para o Dashboard
            </button>
          {/* novo botão para o relatório admin */}
    <button onClick={() => navigate("/informacoes-admin")} style={btnVariant("#9fd3ff")}>
      📑 Ver Relatório Global (Admin)
    </button>
  </div>
        </header>

        {/* IDENTIDADE / RESUMO */}
        <section style={{ ...styles.glassCard }}>
          <div style={styles.identity}>
            <div style={styles.logoBox} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Gerencie rodadas, acompanhe times e publique resultados oficiais.
              </div>
              <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                Prazo atual: <strong>{fmtDateTime(prazo)}</strong> • Market Size (rodada): <strong>{marketSizeRodada ?? "—"}</strong>
              </div>
              <div style={styles.quickRow}>
                <button onClick={carregarHead} style={btnVariant("#9fd3ff")}>🔄 Atualizar Cabeçalho</button>
                <button onClick={carregarTimes} style={btnVariant("#9fd3ff")}>📥 Recarregar Times</button>
              </div>
            </div>
            <div />
          </div>
        </section>

        {/* GRID PRINCIPAL */}
        <div style={styles.grid}>
          {/* CONTROLE DE RODADA */}
          <section style={{ ...styles.glassCard }}>
            <div style={styles.cardBody}>
              <h3 style={styles.sectionTitleTight}>🎛️ Controle de Rodada</h3>
              <div className="grid-3">
                <div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Rodada</div>
                  <div style={{ fontWeight: 700 }}>#{rodadaAtual}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Prazo</div>
                  <div style={{ fontWeight: 700 }}>{fmtDateTime(prazo)}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>Market Size (rodada)</div>
                  <div style={{ fontWeight: 700 }}>{marketSizeRodada ?? "—"}</div>
                </div>
              </div>

              <div style={styles.formBox}>
                <label style={styles.formLabel}>Definir rodada</label>
                <div className="row">
                  <input
                    type="number"
                    min={1}
                    value={inputRodada}
                    onChange={(e) => setInputRodada(Number(e.target.value))}
                    style={{ ...styles.input, width: 120, flexShrink: 0 }}
                  />
                  <button onClick={iniciarRodada} style={btnVariant("#24d08f")}>🚀 Iniciar</button>
                  <button
                    onClick={async () => {
                      dlog("[UI] click: Fechar Rodada", { inputRodada });
                      await fecharRodadaLocal(Number(inputRodada));
                      await carregarHead();
                    }}
                    style={btnVariant("#ff5c7a")}
                  >
                    🔒 Fechar
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* PARÂMETROS DO MERCADO */}
          <section style={{ ...styles.glassCard }}>
            <div style={styles.cardBody}>
              <h3 style={styles.sectionTitleTight}>⚙️ Parâmetros do Mercado</h3>
              <div className="grid-3" style={{ gap: 12 }}>
                <div>
                  <label style={styles.formLabel}>Distribuição</label>
                  <select
                    value={marketDist}
                    onChange={(e) => setMarketDist(e.target.value)}
                    style={styles.select}
                  >
                    <option value="uniform">Uniforme</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                {marketDist === "uniform" ? (
                  <>
                    <div>
                      <label style={styles.formLabel}>Mínimo</label>
                      <input
                        type="number"
                        value={marketMin}
                        onChange={(e) => setMarketMin(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.formLabel}>Máximo</label>
                      <input
                        type="number"
                        value={marketMax}
                        onChange={(e) => setMarketMax(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                    <div />
                  </>
                ) : (
                  <>
                    <div>
                      <label style={styles.formLabel}>Média</label>
                      <input
                        type="number"
                        value={marketMean}
                        onChange={(e) => setMarketMean(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.formLabel}>Desvio</label>
                      <input
                        type="number"
                        value={marketStd}
                        onChange={(e) => setMarketStd(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                    <div />
                    <div>
                      <label style={styles.formLabel}>Mínimo</label>
                      <input
                        type="number"
                        value={marketMin}
                        onChange={(e) => setMarketMin(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                    <div>
                      <label style={styles.formLabel}>Máximo</label>
                      <input
                        type="number"
                        value={marketMax}
                        onChange={(e) => setMarketMax(Number(e.target.value))}
                        style={styles.input}
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ ...styles.formBox, paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={salvarParametrosMercado} style={btnVariant("#4aa3ff")}>
                  💾 Salvar Parâmetros
                </button>
              </div>
            </div>
          </section>

          {/* MÉTRICAS RÁPIDAS */}
          <section style={{ ...styles.glassCard }}>
            <div style={styles.cardBody}>
              <h3 style={styles.sectionTitleTight}>📊 Estatísticas</h3>
              <div className="grid-2">
                <div style={{ ...styles.callout }}>
                  <h4 style={styles.calloutTitle}>Times cadastrados</h4>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>{times.length}</p>
                </div>
                <div style={{ ...styles.callout }}>
                  <h4 style={styles.calloutTitle}>Jogadores</h4>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>{totalJogadores}</p>
                </div>
                <div style={{ ...styles.callout }}>
                  <h4 style={styles.calloutTitle}>Pendentes</h4>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>{totalPendentes}</p>
                </div>
                <div style={{ ...styles.callout }}>
                  <h4 style={styles.calloutTitle}>Aprovados</h4>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>{totalAprovados}</p>
                </div>
              </div>
            </div>
          </section>

          {/* AÇÕES EXTRAS */}
          <section style={{ ...styles.glassCard }}>
            <div style={styles.cardBody}>
              <h3 style={styles.sectionTitleTight}>🧩 Ações Administrativas</h3>
              <div className="row">
                <button
                  onClick={async () => {
                    const docRef = doc(db, "controleRodada", "status");
                    await updateDoc(docRef, { liberarFinal: true });
                    alert("✅ Resultados finais liberados com sucesso!");
                  }}
                  style={btnVariant("#24d08f")}
                >
                  ✅ Liberar Resultados Finais
                </button>
                <button
                  onClick={async () => {
                    const configRef = doc(db, "configuracoes", "geral");
                    await updateDoc(configRef, { cadastroBloqueado: true });
                    alert("🚫 Cadastro de novos times bloqueado com sucesso!");
                  }}
                  style={btnVariant("#ff5c7a")}
                >
                  🚫 Bloquear Cadastro de Novos Times
                </button>
                <button
                  onClick={async () => {
                    const confirmar = window.confirm("Tem certeza que deseja resetar o simulador?");
                    if (!confirmar) return;

                    const configRef = doc(db, "configuracoes", "geral");
                    await updateDoc(configRef, {
                      rodadaAtual: 1,
                      rodadaAtiva: false,
                      cadastroBloqueado: false,
                      prazo: null,
                    });

                    await limparColecoes();

                    setTimes([]);
                    setBusca("");
                    setFiltro("todos");
                    setRodadaAtual(1);
                    setRodadaAtiva(false);
                    setPrazo(null);

                    alert("🔄 Simulador resetado com sucesso!");
                  }}
                  style={btnVariant("#ffb020")}
                >
                  🔄 Resetar Simulador
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* FILTROS */}
        <section style={{ ...styles.glassCard, marginTop: 24 }}>
          <div style={styles.cardBody}>
            <h3 style={styles.sectionTitleTight}>🔎 Filtros</h3>
            <div className="row">
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ ...styles.input, minWidth: 220, flex: 1 }}
              />
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                style={{ ...styles.select, width: 220, flexShrink: 0 }}
              >
                <option value="todos">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="aprovado">Aprovados</option>
              </select>
            </div>
          </div>
        </section>

        {/* LISTA DE TIMES */}
        <section style={{ marginTop: 16 }}>
          {times.length === 0 ? (
            <div style={{ ...styles.glassCard }}>
              <div style={{ ...styles.cardBody, textAlign: "center" }}>
                <p style={{ opacity: 0.9 }}>Nenhum time cadastrado ainda.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {times.map((time) => {
                const membrosFiltrados = filtrarMembros(time.membros || []);
                return (
                  <details key={time.id} style={{ ...styles.glassCard }}>
                    <summary
                      style={{
                        listStyle: "none",
                        padding: 16,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                          <span
                            title={time.id}
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "60vw",
                            }}
                          >
                            {time.nome || time.id}
                          </span>
                          <span style={{ opacity: 0.7, fontSize: 12 }}>({time.id})</span>
                        </div>
                        <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>
                          {Array.isArray(time.membros) ? time.membros.length : 0} membro(s)
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={btnVariant("#ff5c7a")}
                          onClick={(e) => {
                            e.preventDefault();
                            solicitarExclusaoTime(time);
                          }}
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </summary>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }} />

                    <div style={{ padding: 16, display: "grid", gap: 8 }}>
                      {membrosFiltrados.length === 0 ? (
                        <p style={{ opacity: 0.9, fontSize: 14 }}>✅ Nenhum membro encontrado</p>
                      ) : (
                        membrosFiltrados.map((m: any) => (
                          <div
                            key={m.uid}
                            style={{
                              ...styles.glassCard,
                              padding: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "60vw",
                                }}
                              >
                                👤 <strong>{m.nome}</strong> — {m.email}
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <span style={m.status === "pending" ? tagVariant("#ffb020") : tagVariant("#24d08f")}>
                                  {m.status === "pending" ? "⏳ Pendente" : "✅ Aprovado"}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {m.status === "pending" && (
                                <button onClick={() => aprovarMembro(time.id, m.uid)} style={btnVariant("#24d08f")}>
                                  ✅ Aprovar
                                </button>
                              )}
                              <button onClick={() => solicitarExclusaoMembro(time.id, m)} style={btnVariant("#ff5c7a")}>
                                🗑️ Excluir
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        {itemParaExcluir && tipoExclusao && (
          <ConfirmacaoExclusao
            tipo={tipoExclusao}
            item={itemParaExcluir}
            timeId={timeOrigem}
            onConfirmado={async () => {
              setItemParaExcluir(null);
              setTipoExclusao(null);
              setTimeOrigem(undefined);
              await carregarTimes();
            }}
            onCancelado={() => {
              setItemParaExcluir(null);
              setTipoExclusao(null);
              setTimeOrigem(undefined);
            }}
          />
        )}
      </div>
    </div>
  );
}

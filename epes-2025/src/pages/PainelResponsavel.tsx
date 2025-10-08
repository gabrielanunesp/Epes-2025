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
  // lê parâmetros em configuracoes/geral
  const geralRef = doc(db, "configuracoes", "geral");
  const geralSnap = await getDoc(geralRef);
  const g = geralSnap.data() || {};

  const dist: string = g.marketDist || "uniform"; // "uniform" | "normal"
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
        marketSize,
        dist,
        min,
        max,
        mean,
        std,
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
    throw new Error(`Falha ao gravar marketSize da rodada ${rodada}: ${err?.code || ""} ${err?.message || ""}`.trim());
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
  const [tipoExclusao, setTipoExclusao] = useState<"time" | "membro" | null>(
    null
  );
  const [timeOrigem, setTimeOrigem] = useState<string | undefined>(undefined);

  // controle de rodada (configurações/geral)
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
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(d);
    } catch {
      return d.toString();
    }
  };

  const endOfToday = () => {
    const now = new Date();
    // 23:59:00 no horário local (máquina do navegador)
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      0,
      0
    );
    return target;
  };

  // ---------- permissão + carga inicial ----------
  useEffect(() => {
    const verificarPermissao = async () => {
      const user = auth.currentUser;
      dlog("[UI] verificarPermissao: currentUser:", user?.uid || null);
      if (!user) {
        navigate("/login");
        return;
      }

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

  // ---------- leitura de cabeçalho (config/geral) ----------
  const carregarHead = async () => {
    dlog("[UI] carregarHead()" );
    const geralRef = doc(db, "configuracoes", "geral");
    const snap = await getDoc(geralRef);
    const g = snap.data() || {};
    const rAtiva = !!g.rodadaAtiva;
    const rAtual = Number(g.rodadaAtual ?? 1);
    dlog("[UI] head:", { rodadaAtiva: rAtiva, rodadaAtual: rAtual, prazo: g?.prazo });

    setRodadaAtiva(rAtiva);
    setRodadaAtual(rAtual);
    setInputRodada(rAtual);

    // parâmetros de mercado em configuracoes/geral
    setMarketDist(String(g.marketDist || "uniform"));
    setMarketMin(Number(g.marketMin ?? 1600));
    setMarketMax(Number(g.marketMax ?? 2400));
    setMarketMean(Number(g.marketMean ?? 2000));
    setMarketStd(Number(g.marketStd ?? 200));

    // marketSize da rodada (se já foi sorteado ao abrir)
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

    // prazo (timestamp Firestore → Date)
    if (g.prazo?.seconds) {
      setPrazo(new Date(g.prazo.seconds * 1000));
    } else if (g.prazo instanceof Date) {
      setPrazo(g.prazo);
    } else {
      setPrazo(null);
    }
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
    dlog("[UI] carregarTimes()" );
    const timesSnapshot = await getDocs(collection(db, "times"));
    const lista = timesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    dlog("[UI] times carregados:", lista.length);
    dtable(lista.map(t => ({ id: t.id, nome: (t as any).nome, turmaId: (t as any).turmaId, membros: (t as any).membros?.length || 0 })));
    setTimes(lista);
  };

  // ---------- limpar coleções (reset) ----------
  const limparColecoes = async () => {
    const colecoes = [
      "decisoes",
      "jogadores",
      "times",
      "controleRodada",
      "empresas",
      "resultadosOficiais",
    ];

    for (const nome of colecoes) {
      const snapshot = await getDocs(collection(db, nome));
      const deletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletes);
    }

    // subcoleções de rodadas/{turmaId}/rodada1 (e outras se houver)
    const rodadasRootSnap = await getDocs(collection(db, "rodadas"));
    for (const turmaDoc of rodadasRootSnap.docs) {
      const turmaId = turmaDoc.id;
      // Apaga subcoleções conhecidas (rodada1..rodada10). Se quiser percorrer dinamicamente, liste via API Admin.
      for (let i = 1; i <= 10; i++) {
        const sub = collection(db, "rodadas", turmaId, `rodada${i}`);
        const subSnap = await getDocs(sub);
        const subDeletes = subSnap.docs.map((s) => deleteDoc(s.ref));
        await Promise.all(subDeletes);
      }
      // Apaga o doc pai (espelhos planos serão removidos pelo bloco "colecoes")
      await deleteDoc(doc(db, "rodadas", turmaId));
    }
  };

  // ---------- aprovação/exclusão ----------
  const aprovarMembro = async (timeId: string, membroUid: string) => {
    const timeRef = doc(db, "times", timeId);
    const snapshot = await getDoc(timeRef);
    const dados = snapshot.data();

    if (!dados || !Array.isArray(dados.membros)) return;

    const novosMembros = dados.membros.map((m: any) =>
      m.uid === membroUid ? { ...m, status: "aprovado" } : m
    );

    await updateDoc(timeRef, { membros: novosMembros });

    setTimes((prev) =>
      prev.map((t) => (t.id === timeId ? { ...t, membros: novosMembros } : t))
    );
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

  // ---------- UI helpers ----------
  const chipClass = (status?: string) =>
    status === "aprovado"
      ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-medium"
      : status === "pending"
      ? "inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium"
      : "inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5 text-xs font-medium";

  // ---------- estatísticas topo ----------
  const totalPendentes = times.reduce(
    (acc, t) => acc + (t.membros?.filter((m: any) => m.status === "pending").length || 0),
    0
  );
  const totalAprovados = times.reduce(
    (acc, t) => acc + (t.membros?.filter((m: any) => m.status === "aprovado").length || 0),
    0
  );
  const totalJogadores = times.reduce((acc, t) => acc + (t.membros?.length || 0), 0);

  // ---------- iniciar rodada ----------
  const iniciarRodada = async () => {
    try {
      dlog("[UI] iniciarRodada", { inputRodada });
      if (!inputRodada || inputRodada < 1) {
        alert("Informe um número de rodada válido.");
        return;
      }
      const prazoHoje = endOfToday();
      const geralRef = doc(db, "configuracoes", "geral");

      // 1) Atualiza cabeçalho (pode criar o doc se não existir)
      try {
        console.time("iniciarRodada.setHeader");
        await setDoc(
          geralRef,
          {
            rodadaAtual: inputRodada,
            rodadaAtiva: true,
            prazo: prazoHoje,
          },
          { merge: true }
        );
        console.timeEnd("iniciarRodada.setHeader");
        dlog("[UI] iniciarRodada -> atualizado config/geral", {
          rodadaAtual: inputRodada,
          rodadaAtiva: true,
          prazo: prazoHoje,
        });
      } catch (err: any) {
        console.error("❌ Falha ao atualizar config/geral:", {
          path: "configuracoes/geral",
          error: { code: err?.code, name: err?.name, message: err?.message, stack: err?.stack },
        });
        alert(`❌ Erro ao atualizar 'configuracoes/geral': ${err?.code || ""} ${err?.message || ""}`.trim());
        return;
      }

      // 2) Sorteia e grava Market Size da rodada
      let ms: number;
      try {
        console.time("iniciarRodada.gerarMarketSize");
        ms = await gerarEGravarMarketSizeDaRodada(inputRodada);
        console.timeEnd("iniciarRodada.gerarMarketSize");
      } catch (err: any) {
        console.error("❌ Falha ao gerar/gravar Market Size:", {
          rodada: inputRodada,
          error: { code: err?.code, name: err?.name, message: err?.message, stack: err?.stack },
        });
        alert(`❌ Erro ao gravar Market Size da rodada ${inputRodada}: ${err?.code || ""} ${err?.message || ""}`.trim());
        return;
      }

      // 3) Atualiza estado local e notifica sucesso
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

  // ---------- fechar rodada (usa serviço de cálculo coletivo) ----------
// ---------- fechar rodada (usa serviço de cálculo coletivo) ----------
const fecharRodadaLocal = async (rodada: number) => {
  console.groupCollapsed("🔒 [UI] Fechar Rodada");
  try {
    dlog("➡️ params:", { rodada });
    console.time("fecharRodadaLocal.total");

    if (!rodada || rodada < 1) {
      console.warn("[UI] rodada inválida:", rodada);
      alert("Informe um número de rodada válido.");
      return;
    }

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
      const times = timesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.timeEnd("fecharRodadaLocal.findTurmaFromTimes");
      dtable(times.map(t => ({ id: (t as any).id, turmaId: (t as any).turmaId })));
      turmaIdEfetiva =
        (times.find(t => (t as any).turmaId) as any)?.turmaId || times[0]?.id;
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

  if (carregando) return <p className="text-sm text-gray-600">🔄 Carregando painel...</p>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-6">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">🛡️ Painel do Responsável</h1>
            <p className="mt-1 text-sm text-slate-600">Gerencie rodadas, acompanhe times e publique resultados oficiais.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${rodadaAtiva ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"}`}>
              {rodadaAtiva ? "Rodada Ativa" : "Rodada Fechada"}
            </span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium">Rodada #{rodadaAtual}</span>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-auto shrink-0"
            >
              🧭 Ir para o Dashboard
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* --------- Controle Único de Rodada --------- */}
      <section className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm p-4 md:p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">🎛️ Controle de Rodada</h3>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Rodada:</dt>
                <dd className="font-medium">#{rodadaAtual}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Prazo:</dt>
                <dd className="font-medium">{fmtDateTime(prazo)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-slate-500">Market Size (rodada):</dt>
                <dd className="font-medium">{marketSizeRodada ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                Definir rodada:
                <input
                  type="number"
                  min={1}
                  value={inputRodada}
                  onChange={(e) => setInputRodada(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <button
                onClick={iniciarRodada}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-auto shrink-0"
              >
                🚀 Iniciar
              </button>

              <button
                onClick={async () => {
                  dlog("[UI] click: Fechar Rodada", { inputRodada });
                  await fecharRodadaLocal(Number(inputRodada));
                  await carregarHead();
                }}
                className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 w-auto shrink-0"
              >
                🔒 Fechar
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --------- Parâmetros do Mercado (por rodada) --------- */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm mb-6">
        <h3 className="text-lg font-semibold mb-4">⚙️ Parâmetros do Mercado</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Dist:
            <select
              value={marketDist}
              onChange={(e) => setMarketDist(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="uniform">Uniforme</option>
              <option value="normal">Normal</option>
            </select>
          </label>
          {marketDist === "uniform" ? (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Min:
                <input
                  type="number"
                  value={marketMin}
                  onChange={(e) => setMarketMin(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Max:
                <input
                  type="number"
                  value={marketMax}
                  onChange={(e) => setMarketMax(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Média:
                <input
                  type="number"
                  value={marketMean}
                  onChange={(e) => setMarketMean(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Desvio:
                <input
                  type="number"
                  value={marketStd}
                  onChange={(e) => setMarketStd(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Mínimo:
                <input
                  type="number"
                  value={marketMin}
                  onChange={(e) => setMarketMin(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Máximo:
                <input
                  type="number"
                  value={marketMax}
                  onChange={(e) => setMarketMax(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </label>
            </>
          )}
          <button
            onClick={salvarParametrosMercado}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-auto shrink-0"
          >
            💾 Salvar Parâmetros
          </button>
        </div>
      </div>
      </div>

      {/* --------- Estatísticas rápidas --------- */}
      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm text-slate-500">Times cadastrados</p>
          <p className="mt-2 text-2xl font-semibold">{times.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm text-slate-500">Membros pendentes</p>
          <p className="mt-2 text-2xl font-semibold">{totalPendentes}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm text-slate-500">Membros aprovados</p>
          <p className="mt-2 text-2xl font-semibold">{totalAprovados}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm text-slate-500">Jogadores</p>
          <p className="mt-2 text-2xl font-semibold">{totalJogadores}</p>
        </div>
      </section>

      {/* --------- Ações administrativas extras --------- */}
      <div className="my-6 rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
        <h3>🔓 Controle da Última Rodada</h3>
        <button
          onClick={async () => {
            const docRef = doc(db, "controleRodada", "status");
            await updateDoc(docRef, { liberarFinal: true });
            alert("✅ Resultados finais liberados com sucesso!");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          ✅ Liberar Resultados Finais
        </button>
      </div>

      <div className="my-6 rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
        <h3>🚫 Controle de Cadastro</h3>
        <button
          onClick={async () => {
            const configRef = doc(db, "configuracoes", "geral");
            await updateDoc(configRef, { cadastroBloqueado: true });
            alert("🚫 Cadastro de novos times bloqueado com sucesso!");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          🚫 Bloquear Cadastro de Novos Times
        </button>
      </div>

      <div className="my-6 rounded-lg border border-gray-200 bg-white p-4 md:p-6 shadow-sm">
        <h3>🔄 Resetar Simulador</h3>
        <button
          onClick={async () => {
            const confirmar = window.confirm(
              "Tem certeza que deseja resetar o simulador?"
            );
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
          className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-black shadow hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          🔄 Resetar Simulador
        </button>
      </div>

      {/* --------- Filtros --------- */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="🔎 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="todos">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="aprovado">Aprovados</option>
        </select>
      </div>

      {/* --------- Lista de times e membros --------- */}
      <section className="space-y-4">
        {times.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">Nenhum time cadastrado ainda.</p>
          </div>
        ) : (
          times.map((time) => (
            <details key={time.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm open:shadow-md transition-shadow">
              <summary className="cursor-pointer list-none p-4 md:p-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <span className="truncate max-w-[60vw]">{time.nome || time.id}</span>
                    <span className="text-xs font-normal text-slate-500">({time.id})</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {Array.isArray(time.membros) ? time.membros.length : 0} membro(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    onClick={(e) => {
                      e.preventDefault();
                      solicitarExclusaoTime(time);
                    }}
                  >
                    🗑️ Excluir
                  </button>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                </div>
              </summary>

              <div className="border-t border-slate-200 p-4 md:p-5">
                <div className="grid gap-3">
                  {filtrarMembros(time.membros || []).length === 0 ? (
                    <p className="text-sm text-slate-600">✅ Nenhum membro encontrado</p>
                  ) : (
                    filtrarMembros(time.membros || []).map((m: any) => (
                      <div
                        key={m.uid}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:p-4 text-sm flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate">
                            👤 <span className="font-medium">{m.nome}</span> — {m.email}
                          </p>
                          <div className="mt-1">
                            <span className={chipClass(m.status)}>
                              {m.status === "pending" ? "⏳ Pendente" : "✅ Aprovado"}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {m.status === "pending" && (
                            <button
                              onClick={() => aprovarMembro(time.id, m.uid)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              ✅ Aprovar
                            </button>
                          )}
                          <button
                            onClick={() => solicitarExclusaoMembro(time.id, m)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          >
                            🗑️ Excluir
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>
          ))
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

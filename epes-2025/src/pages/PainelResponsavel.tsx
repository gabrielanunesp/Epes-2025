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
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ConfirmacaoExclusao from "../components/ConfirmacaoExclusao";
import "./PainelResponsavel.css";

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
      if (!user) {
        navigate("/login");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);
      const dados = snapshot.data();

      if (dados?.papel !== "responsavel") {
        navigate("/dashboard");
        return;
      }

      await Promise.all([carregarTimes(), carregarHead()]);
      setCarregando(false);
    };

    verificarPermissao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ---------- leitura de cabeçalho (config/geral) ----------
  const carregarHead = async () => {
    const geralRef = doc(db, "configuracoes", "geral");
    const snap = await getDoc(geralRef);
    const g = snap.data() || {};
    const rAtiva = !!g.rodadaAtiva;
    const rAtual = Number(g.rodadaAtual ?? 1);

    setRodadaAtiva(rAtiva);
    setRodadaAtual(rAtual);
    setInputRodada(rAtual);

    // prazo (timestamp Firestore → Date)
    if (g.prazo?.seconds) {
      setPrazo(new Date(g.prazo.seconds * 1000));
    } else if (g.prazo instanceof Date) {
      setPrazo(g.prazo);
    } else {
      setPrazo(null);
    }
  };

  // ---------- leitura de times ----------
  const carregarTimes = async () => {
    const timesSnapshot = await getDocs(collection(db, "times"));
    const lista = timesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
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
      if (!inputRodada || inputRodada < 1) {
        alert("Informe um número de rodada válido.");
        return;
      }
      const prazoHoje = endOfToday();
      const geralRef = doc(db, "configuracoes", "geral");
      await updateDoc(geralRef, {
        rodadaAtual: inputRodada,
        rodadaAtiva: true,
        prazo: prazoHoje,
      });
      setRodadaAtual(inputRodada);
      setRodadaAtiva(true);
      setPrazo(prazoHoje);
      alert(`🚀 Rodada ${inputRodada} iniciada!`);
    } catch (e: any) {
      console.error("Erro ao iniciar rodada:", e);
      alert("❌ Erro ao iniciar rodada. Veja o console.");
    }
  };

  // ---------- fechar rodada (gera oficiais) ----------
  const fecharRodadaLocal = async (rodada: number) => {
    try {
      if (!rodada || rodada < 1) {
        alert("Informe um número de rodada válido.");
        return;
      }

      console.log("🔒 Fechando rodada local:", rodada);

      // 1) Confere config (apenas log)
      const geralRef = doc(db, "configuracoes", "geral");
      const geralSnap = await getDoc(geralRef);
      const g = geralSnap.data() || {};
      console.log(
        "ℹ️ rodadaAtual(conf):",
        g.rodadaAtual,
        "rodadaAtiva(conf):",
        g.rodadaAtiva
      );

      // 2) Times (ids)
      const timesSnap = await getDocs(collection(db, "times"));
      const timeIds = timesSnap.docs.map((d) => d.id);

      let gerados = 0;
      let semResposta = 0;

      for (const timeId of timeIds) {
        // pega decisões dessa turma/time na rodadaN
        const sub = collection(db, "rodadas", timeId, `rodada${rodada}`);
        const enviosSnap = await getDocs(sub);

        let dadosOficiais: any;

        if (!enviosSnap.empty) {
          // pega o MAIS recente por timestamp
          const ordenados = enviosSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .sort((a, b) => {
              const ta = a.timestamp?.seconds ?? 0;
              const tb = b.timestamp?.seconds ?? 0;
              return tb - ta;
            });

          const d = ordenados[0];
          dadosOficiais = {
            timeId,
            turmaId: timeId,
            rodada,
            ea: d.ea ?? 0,
            demanda: d.demanda ?? 0,
            receita: d.receita ?? 0,
            custo: d.custo ?? 0,
            lucro: d.lucro ?? 0,
            reinvestimento: d.reinvestimento ?? 0,
            caixaFinal: d.caixaFinal ?? 0,
            satisfacao: d.satisfacao ?? 0,
            atraso: !!d.atraso,
            decisaoForaDoPrazo: false,
            status: "✅",
            timestamp: new Date(),
          };
        } else {
          // sem envio: mínimo e marca atraso
          semResposta++;
          dadosOficiais = {
            timeId,
            turmaId: timeId,
            rodada,
            ea: 0,
            demanda: 0,
            receita: 0,
            custo: 0,
            lucro: 0,
            reinvestimento: 0,
            caixaFinal: 0,
            satisfacao: 0,
            atraso: true,
            decisaoForaDoPrazo: true,
            status: "⚠️",
            timestamp: new Date(),
          };
        }

        // grava oficial
        await setDoc(
          doc(db, "resultadosOficiais", timeId, `rodada${rodada}`, "oficial"),
          dadosOficiais
        );
        gerados++;
      }

      // 3) marca rodadaAtiva=false (rodadaAtual permanece)
      await updateDoc(doc(db, "configuracoes", "geral"), { rodadaAtiva: false });

      setRodadaAtiva(false);
      alert(
        `✅ Rodada ${rodada} fechada! Oficiais gerados: ${gerados}. Sem resposta: ${semResposta}.`
      );
    } catch (e: any) {
      console.error("❌ Erro no fechamento local:", e);
      alert("❌ Erro ao fechar rodada. Veja o console para detalhes.");
    }
  };

  if (carregando) return <p>🔄 Carregando painel...</p>;

  return (
    <div className="page-container">
      <h2>🛡️ Painel do Responsável</h2>

      <button
        onClick={() => navigate("/dashboard")}
        style={{
          marginBottom: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        🧭 Ir para o Dashboard
      </button>

      {/* --------- Controle Único de Rodada --------- */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "1rem",
          marginBottom: "1.5rem",
          background: "#fafafa",
        }}
      >
        <h3>🎛️ Controle de Rodada</h3>

        <p style={{ margin: 0 }}>
          <strong>Rodada atual no sistema:</strong>{" "}
          #{rodadaAtual} — {rodadaAtiva ? "🟢 Ativa" : "🔴 Fechada"}
          <br />
          <strong>⏳ Prazo:</strong> {fmtDateTime(prazo)}
        </p>

        <div style={{ marginTop: 12 }}>
          <label style={{ marginRight: 8 }}>Definir rodada:</label>
          <input
            type="number"
            min={1}
            value={inputRodada}
            onChange={(e) => setInputRodada(Number(e.target.value))}
            style={{ width: 80, marginRight: 12 }}
          />

          <button
            onClick={iniciarRodada}
            style={{
              padding: "0.4rem 0.8rem",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: 8,
            }}
          >
            🚀 Iniciar Rodada
          </button>

          <button
            onClick={async () => {
              await fecharRodadaLocal(Number(inputRodada));
              await carregarHead();
            }}
            style={{
              padding: "0.4rem 0.8rem",
              backgroundColor: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            🔒 Fechar Rodada Agora (Local)
          </button>
        </div>
      </div>

      {/* --------- Estatísticas rápidas --------- */}
      <div className="estatisticas">
        <p>📊 Times cadastrados: {times.length}</p>
        <p>⏳ Membros pendentes: {totalPendentes}</p>
        <p>✅ Membros aprovados: {totalAprovados}</p>
        <p>👤 Jogadores cadastrados: {totalJogadores}</p>
      </div>

      {/* --------- Ações administrativas extras --------- */}
      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <h3>🔓 Controle da Última Rodada</h3>
        <button
          onClick={async () => {
            const docRef = doc(db, "controleRodada", "status");
            await updateDoc(docRef, { liberarFinal: true });
            alert("✅ Resultados finais liberados com sucesso!");
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ✅ Liberar Resultados Finais
        </button>
      </div>

      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <h3>🚫 Controle de Cadastro</h3>
        <button
          onClick={async () => {
            const configRef = doc(db, "configuracoes", "geral");
            await updateDoc(configRef, { cadastroBloqueado: true });
            alert("🚫 Cadastro de novos times bloqueado com sucesso!");
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          🚫 Bloquear Cadastro de Novos Times
        </button>
      </div>

      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
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
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#ffc107",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          🔄 Resetar Simulador
        </button>
      </div>

      {/* --------- Filtros --------- */}
      <div className="filtros">
        <input
          type="text"
          placeholder="🔎 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="aprovado">Aprovados</option>
        </select>
      </div>

      {/* --------- Lista de times e membros --------- */}
      {times.map((time) => (
        <div key={time.id} className="time-card">
          <h3>🏷️ {time.nome || time.id}</h3>
          <p>Código: {time.id}</p>
          <button
            className="excluir-time"
            onClick={() => solicitarExclusaoTime(time)}
          >
            🗑️ Excluir Time
          </button>

          <div className="membros-lista">
            {filtrarMembros(time.membros || []).length === 0 ? (
              <p>✅ Nenhum membro encontrado</p>
            ) : (
              filtrarMembros(time.membros || []).map((m: any) => (
                <div key={m.uid} className={`membro-card ${m.status}`}>
                  <p>
                    👤 {m.nome} — {m.email}
                  </p>
                  <span className="status">
                    {m.status === "pending" ? "⏳ Pendente" : "✅ Aprovado"}
                  </span>
                  <div className="acoes">
                    {m.status === "pending" && (
                      <button onClick={() => aprovarMembro(time.id, m.uid)}>
                        ✅ Aprovar
                      </button>
                    )}
                    <button
                      onClick={() => solicitarExclusaoMembro(time.id, m)}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

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
  );
}

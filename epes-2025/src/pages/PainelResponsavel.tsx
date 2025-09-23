import React, { useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ControleRodadaADM from "../components/ControleRodadaADM";
import CronometroRodada from "../components/CronometroRodada";
import ConfirmacaoExclusao from "../components/ConfirmacaoExclusao";
import "./PainelResponsavel.css";

export default function PainelResponsavel() {
  const [times, setTimes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [itemParaExcluir, setItemParaExcluir] = useState<any>(null);
  const [tipoExclusao, setTipoExclusao] = useState<"time" | "membro" | null>(null);
  const [timeOrigem, setTimeOrigem] = useState<string | undefined>(undefined);
  const navigate = useNavigate();

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

      await carregarTimes();
      setCarregando(false);
    };

    verificarPermissao();
  }, [navigate]);

  const carregarTimes = async () => {
    const timesSnapshot = await getDocs(collection(db, "times"));
    const lista = timesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setTimes(lista);
  };

  const limparColecoes = async () => {
    const colecoes = ["decisoes", "jogadores", "times", "controleRodada", "empresas"];

    for (const nome of colecoes) {
      const snapshot = await getDocs(collection(db, nome));
      const deletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
      await Promise.all(deletes);
    }

    const rodadasSnapshot = await getDocs(collection(db, "rodadas"));
    for (const turmaDoc of rodadasSnapshot.docs) {
      const turmaId = turmaDoc.id;

      const rodadaSub = collection(db, "rodadas", turmaId, "rodada1");
      const rodadaSnap = await getDocs(rodadaSub);
      const subDeletes = rodadaSnap.docs.map((subDoc) => deleteDoc(subDoc.ref));
      await Promise.all(subDeletes);

      await deleteDoc(doc(db, "rodadas", turmaId));
    }

    const turmasFantasmas = ["306020", "231614", "455035"];
    for (const turmaId of turmasFantasmas) {
      const rodadaSub = collection(db, "rodadas", turmaId, "rodada1");
      const rodadaSnap = await getDocs(rodadaSub);
      const subDeletes = rodadaSnap.docs.map((subDoc) => deleteDoc(subDoc.ref));
      await Promise.all(subDeletes);

      await deleteDoc(doc(db, "rodadas", turmaId));
    }
  };
  const aprovarMembro = async (timeId: string, membroUid: string) => {
    const timeRef = doc(db, "times", timeId);
    const snapshot = await getDoc(timeRef);
    const dados = snapshot.data();

    if (!dados || !Array.isArray(dados.membros)) return;

    const novosMembros = dados.membros.map((m: any) =>
      m.uid === membroUid ? { ...m, status: "aprovado" } : m
    );

    await updateDoc(timeRef, { membros: novosMembros });

    setTimes(prev =>
      prev.map(t =>
        t.id === timeId ? { ...t, membros: novosMembros } : t
      )
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

  const filtrarMembros = (membros: any[]) => {
    return membros.filter((m) => {
      const nomeMatch = m.nome.toLowerCase().includes(busca.toLowerCase());
      const emailMatch = m.email.toLowerCase().includes(busca.toLowerCase());
      const statusMatch =
        filtro === "todos" || m.status === filtro;

      return (nomeMatch || emailMatch) && statusMatch;
    });
  };

  const totalPendentes = times.reduce(
    (acc, t) => acc + t.membros?.filter((m: any) => m.status === "pending").length || 0,
    0
  );
  const totalAprovados = times.reduce(
    (acc, t) => acc + t.membros?.filter((m: any) => m.status === "aprovado").length || 0,
    0
  );
  const totalJogadores = times.reduce(
    (acc, t) => acc + (t.membros?.length || 0),
    0
  );

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
          cursor: "pointer"
        }}
      >
        🧭 Ir para o Dashboard
      </button>

      <CronometroRodada modo="adm" />
      <ControleRodadaADM />

      <div className="estatisticas">
        <p>📊 Times cadastrados: {times.length}</p>
        <p>⏳ Membros pendentes: {totalPendentes}</p>
        <p>✅ Membros aprovados: {totalAprovados}</p>
        <p>👤 Jogadores cadastrados: {totalJogadores}</p>
      </div>

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
            cursor: "pointer"
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
            cursor: "pointer"
          }}
        >
          🚫 Bloquear Cadastro de Novos Times
        </button>
      </div>

      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <h3>🔄 Resetar Simulador</h3>
        <button
          onClick={async () => {
            const confirmar = window.confirm("Tem certeza que deseja resetar o simulador?");
            if (!confirmar) return;

            const configRef = doc(db, "configuracoes", "geral");
            await updateDoc(configRef, {
              rodadaAtual: 1,
              rodadaAtiva: false,
              cadastroBloqueado: false
            });

            await limparColecoes();

            setTimes([]);
            setBusca("");
            setFiltro("todos");

            alert("🔄 Simulador resetado com sucesso!");
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#ffc107",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          🔄 Resetar Simulador
        </button>
      </div>

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

      {times.map((time) => (
        <div key={time.id} className="time-card">
          <h3>🏷️ {time.nome}</h3>
          <p>Código: {time.id}</p>
          <button className="excluir-time" onClick={() => solicitarExclusaoTime(time)}>🗑️ Excluir Time</button>

          <div className="membros-lista">
            {filtrarMembros(time.membros || []).length === 0 ? (
              <p>✅ Nenhum membro encontrado</p>
            ) : (
              filtrarMembros(time.membros || []).map((m: any) => (
                <div key={m.uid} className={`membro-card ${m.status}`}>
                  <p>👤 {m.nome} — {m.email}</p>
                  <span className="status">
                    {m.status === "pending" ? "⏳ Pendente" : "✅ Aprovado"}
                  </span>
                  <div className="acoes">
                    {m.status === "pending" && (
                      <button onClick={() => aprovarMembro(time.id, m.uid)}>✅ Aprovar</button>
                    )}
                    <button onClick={() => solicitarExclusaoMembro(time.id, m)}>🗑️ Excluir</button>
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

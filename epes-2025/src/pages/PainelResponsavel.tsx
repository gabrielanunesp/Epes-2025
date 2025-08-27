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
import "./PainelResponsavel.css";

export default function PainelResponsavel() {
  const [times, setTimes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
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

      const timesSnapshot = await getDocs(collection(db, "times"));
      const lista = timesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTimes(lista);
      setCarregando(false);
    };

    verificarPermissao();
  }, [navigate]);

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

  const excluirMembro = async (timeId: string, membroUid: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este jogador?")) return;

    const timeRef = doc(db, "times", timeId);
    const snapshot = await getDoc(timeRef);
    const dados = snapshot.data();

    if (!dados || !Array.isArray(dados.membros)) return;

    const membrosAtualizados = dados.membros.filter((m: any) => m.uid !== membroUid);

    await updateDoc(timeRef, { membros: membrosAtualizados });

    setTimes(prev =>
      prev.map(t =>
        t.id === timeId ? { ...t, membros: membrosAtualizados } : t
      )
    );
  };

  const excluirTime = async (timeId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este time?")) return;

    await deleteDoc(doc(db, "times", timeId));
    setTimes(prev => prev.filter(t => t.id !== timeId));
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

      <div className="estatisticas">
        <p>📊 Times cadastrados: {times.length}</p>
        <p>⏳ Membros pendentes: {totalPendentes}</p>
        <p>✅ Membros aprovados: {totalAprovados}</p>
        <p>👤 Jogadores cadastrados: {totalJogadores}</p>
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
          <button className="excluir-time" onClick={() => excluirTime(time.id)}>🗑️ Excluir Time</button>

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
                    <button onClick={() => excluirMembro(time.id, m.uid)}>🗑️ Excluir</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
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

      <CronometroRodada modo="adm" />
      <ControleRodadaADM />

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

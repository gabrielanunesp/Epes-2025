import React, { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function D0Identidade() {
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [slogan, setSlogan] = useState("");
  const [cor, setCor] = useState("#000000");
  const [mensagem, setMensagem] = useState("");
  const navigate = useNavigate();

  const handleSalvar = async () => {
    const user = auth.currentUser;
    const codigoTurma = localStorage.getItem("codigoTurma");

    if (!user || !codigoTurma) {
      setMensagem("❌ Usuário não autenticado ou código da turma ausente.");
      return;
    }

    if (!nomeEmpresa || !publicoAlvo || !slogan) {
      setMensagem("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      await setDoc(doc(db, "empresas", codigoTurma), {
        nomeEmpresa,
        publicoAlvo,
        slogan,
        cor,
        identidadeDefinida: true,
        criadoPor: user.uid,
        timestamp: new Date(),
      });

      setMensagem("✅ Identidade definida com sucesso!");
      navigate("/d1-pre-lancamento");
    } catch (error) {
      console.error("Erro ao salvar identidade:", error);
      setMensagem("❌ Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>🚀 Defina a Identidade da Sua Startup</h2>

      <input
        type="text"
        placeholder="🏷️ Nome da empresa"
        value={nomeEmpresa}
        onChange={(e) => setNomeEmpresa(e.target.value)}
      />
      <select value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)}>
        <option value="">🎯 Selecione o público-alvo</option>
        <option value="jovens">👶 Jovens</option>
        <option value="classe-cd">🏘️ Classe C/D</option>
        <option value="seniores">👴 Sêniores</option>
      </select>
      <input
        type="text"
        placeholder="💬 Missão ou slogan"
        value={slogan}
        onChange={(e) => setSlogan(e.target.value)}
      />
      <label>🎨 Cor da marca:</label>
      <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} />

      <button onClick={handleSalvar} style={{ marginTop: "1rem" }}>
        💾 Salvar Identidade
      </button>

      {mensagem && <p style={{ marginTop: "1rem" }}>{mensagem}</p>}
    </div>
  );
}

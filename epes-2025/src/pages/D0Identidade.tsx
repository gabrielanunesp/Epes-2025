import React, { useState } from "react";
import { auth, db } from "../services/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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

    if (!user || typeof codigoTurma !== "string" || codigoTurma.trim() === "") {
      setMensagem("❌ Usuário não autenticado ou código da turma ausente.");
      return;
    }

    if (!nomeEmpresa || !publicoAlvo || !slogan) {
      setMensagem("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }

    const dados = {
      nome: nomeEmpresa,
      publicoAlvo,
      missao: slogan,
      cor,
      identidadeDefinida: true,
      criadoPor: user.uid,
      timestamp: serverTimestamp(),
    };

    console.log("📤 Dados enviados:", dados);

    try {
      await setDoc(doc(db, "empresas", codigoTurma), dados);
      setMensagem("✅ Identidade definida com sucesso!");
      navigate("/d1-pre-lancamento");
    } catch (error) {
      console.error("🔥 Erro ao salvar identidade:", error);
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
        <option value="Jovens (15–24 anos)">👶 Jovens (15–24 anos)</option>
        <option value="Adultos (25–40 anos)">🧑 Adultos (25–40 anos)</option>
        <option value="Sêniores (40+)">👴 Sêniores (40+)</option>
        <option value="Classe A/B">🏙️ Classe A/B</option>
        <option value="Classe C/D">🏘️ Classe C/D</option>
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

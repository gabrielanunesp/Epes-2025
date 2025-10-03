import React, { useState, useEffect } from "react";
import { auth, db } from "../services/firebase";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function D0Identidade() {
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [slogan, setSlogan] = useState("");
  const [cor, setCor] = useState("#000000");
  const [mensagem, setMensagem] = useState("");
  const [identidadeDefinida, setIdentidadeDefinida] = useState(false);
  const [contagemPublicos, setContagemPublicos] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEmpresa = async () => {
      const codigoTurma = localStorage.getItem("codigoTurma");
      if (!codigoTurma) return;

      const docRef = doc(db, "empresas", codigoTurma);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIdentidadeDefinida(data.identidadeDefinida || false);
        setPublicoAlvo(data.publicoAlvo || "");

        // ✅ Redireciona se já estiver definida
        if (data.identidadeDefinida) {
          navigate("/dashboard");
        }
      }
    };

    const contarPublicos = async () => {
      const publicos = [
        "Jovens (15–24 anos)",
        "Adultos (25–40 anos)",
        "Sêniores (40+)",
        "Classe A/B",
        "Classe C/D",
      ];

      const resultados: Record<string, number> = {};

      for (const publico of publicos) {
        const q = query(collection(db, "empresas"), where("publicoAlvo", "==", publico));
        const snapshot = await getDocs(q);
        resultados[publico] = snapshot.size;
      }

      setContagemPublicos(resultados);
    };

    fetchEmpresa();
    contarPublicos();
  }, []);

  const handleSalvar = async () => {
    // ✅ Bloqueia tentativa de alteração
    if (identidadeDefinida) {
      setMensagem("⚠️ A identidade já foi definida. O público-alvo não pode ser alterado.");
      return;
    }

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
      navigate("/dashboard");
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

      <select
        value={publicoAlvo}
        onChange={(e) => setPublicoAlvo(e.target.value)}
        disabled={identidadeDefinida}
      >
        <option value="">🎯 Selecione o público-alvo</option>
        <option value="Jovens (15–24 anos)">👶 Jovens (15–24 anos)</option>
        <option value="Adultos (25–40 anos)">🧑 Adultos (25–40 anos)</option>
        <option value="Sêniores (40+)">👴 Sêniores (40+)</option>
        <option value="Classe A/B">🏙️ Classe A/B</option>
        <option value="Classe C/D">🏘️ Classe C/D</option>
      </select>

      <ul style={{ marginTop: "1rem" }}>
        {Object.entries(contagemPublicos).map(([publico, total]) => (
          <li key={publico}>
            {publico}: {total} empresa(s) cadastrada(s)
          </li>
        ))}
      </ul>

      <input
        type="text"
        placeholder="💬 Missão ou slogan"
        value={slogan}
        onChange={(e) => setSlogan(e.target.value)}
      />

      <label>🎨 Cor da marca:</label>
      <div
        onClick={() => document.getElementById("seletor-cor")?.click()}
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: cor,
          border: "2px solid #ccc",
          borderRadius: "4px",
          cursor: "pointer",
          display: "inline-block",
          marginLeft: "10px",
        }}
        title={`Cor atual: ${cor}`}
      ></div>

      <input
        type="color"
        id="seletor-cor"
        value={cor}
        onChange={(e) => setCor(e.target.value)}
        style={{ display: "none" }}
      />

      <button onClick={handleSalvar} style={{ marginTop: "1rem" }}>
        💾 Salvar Identidade
      </button>

      {mensagem && <p style={{ marginTop: "1rem" }}>{mensagem}</p>}
    </div>
  );
}

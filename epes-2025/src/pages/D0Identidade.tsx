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

const styles = {
  wrapper: {
    minHeight: "100vh",
    width: "100vw",
    backgroundColor: "#0d0d0d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box" as const,
    color: "#fff",
  },
  card: {
    background: "rgba(25, 25, 25, 0.9)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
    padding: "28px",
    width: "min(560px, 92vw)",
  },
  title: {
    margin: "0 0 16px 0",
    fontSize: "22px",
    fontWeight: 700,
    color: "#fff",
  },
  input: {
    width: "100%",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#fff",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "12px",
    outline: "none",
  } as React.CSSProperties,
  select: {
    width: "100%",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    color: "#fff",
    borderRadius: "10px",
    padding: "12px 14px",
    marginTop: "4px",
    marginBottom: "12px",
    outline: "none",
  } as React.CSSProperties,
  small: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "13px",
    marginBottom: "6px",
    display: "block",
  },
  list: {
    marginTop: "8px",
    marginBottom: "16px",
    paddingLeft: "18px",
    color: "rgba(255,255,255,0.85)",
  },
  colorRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "4px",
    marginBottom: "12px",
  },
  colorSwatch: {
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
  },
  button: {
    width: "100%",
    background: "#1f1f1f",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "10px",
    padding: "12px 14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    marginTop: "6px",
  },
  message: {
    marginTop: "12px",
    color: "#e6e6e6",
  },
};

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
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>🚀 Defina a Identidade da Sua Startup</h2>

        <input
          type="text"
          placeholder="🏷️ Nome da empresa"
          value={nomeEmpresa}
          onChange={(e) => setNomeEmpresa(e.target.value)}
          style={styles.input}
        />

        <small style={styles.small}>🎯 Público-alvo</small>
        <select
          value={publicoAlvo}
          onChange={(e) => setPublicoAlvo(e.target.value)}
          disabled={identidadeDefinida}
          style={styles.select}
        >
          <option value="">🎯 Selecione o público-alvo</option>
          <option value="Jovens (15–24 anos)">👶 Jovens (15–24 anos)</option>
          <option value="Adultos (25–40 anos)">🧑 Adultos (25–40 anos)</option>
          <option value="Sêniores (40+)">👴 Sêniores (40+)</option>
          <option value="Classe A/B">🏙️ Classe A/B</option>
          <option value="Classe C/D">🏘️ Classe C/D</option>
        </select>

        <ul style={styles.list}>
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
          style={styles.input}
        />

        <small style={styles.small}>🎨 Cor da marca</small>
        <div style={styles.colorRow}>
          <div
            onClick={() => document.getElementById("seletor-cor")?.click()}
            style={{ ...styles.colorSwatch, backgroundColor: cor }}
            title={`Cor atual: ${cor}`}
          />
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{cor}</span>
        </div>
        <input
          type="color"
          id="seletor-cor"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          style={{ display: "none" }}
        />

        <button
          onClick={handleSalvar}
          style={styles.button}
          onMouseOver={e => (e.currentTarget.style.background = '#2a2a2a')}
          onMouseOut={e => (e.currentTarget.style.background = '#1f1f1f')}
        >
          💾 Salvar Identidade
        </button>

        {mensagem && <p style={styles.message}>{mensagem}</p>}
      </div>
    </div>
  );
}

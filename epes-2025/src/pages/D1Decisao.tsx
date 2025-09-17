import React, { useState } from "react";
import { auth, db } from "../services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function D1Decisao() {
  const [produto, setProduto] = useState(0);
  const [marketing, setMarketing] = useState(0);
  const [capacidade, setCapacidade] = useState(0);
  const [equipe, setEquipe] = useState(0);
  const [beneficio, setBeneficio] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const navigate = useNavigate();

  const saldoTotal = 500000;
  const saldoRestante =
    saldoTotal - produto - marketing - capacidade - equipe - beneficio;

  const handleSalvar = async () => {
    const user = auth.currentUser;
    const codigoTurma = localStorage.getItem("codigoTurma");

    if (!user || !codigoTurma) {
      setMensagem("❌ Usuário não autenticado ou código da turma ausente.");
      return;
    }

    if (saldoRestante < 0) {
      setMensagem("⚠️ Você ultrapassou o limite de R$ 500.000.");
      return;
    }

    try {
      await setDoc(
        doc(db, "times", codigoTurma),
        {
          produto,
          marketing,
          capacidade,
          equipe,
          beneficio,
          atributosIniciaisDefinidos: true,
        },
        { merge: true }
      );

      setMensagem("✅ Decisões salvas com sucesso!");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      console.error("Erro ao salvar decisões:", error);
      setMensagem("❌ Erro ao salvar. Tente novamente.");
    }
  };

  const renderSlider = (
    label: string,
    value: number,
    setValue: (val: number) => void
  ) => (
    <div style={{ marginBottom: "1.5rem" }}>
      <label>
        <strong>{label}</strong>: R$ {value.toLocaleString("pt-BR")}
      </label>
      <input
        type="range"
        min={0}
        max={500000}
        step={10000}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h2>📦 Decisões de Pré-Lançamento</h2>
      <p>Alocar até <strong>R$ 500.000</strong> nos atributos iniciais da startup:</p>

      {renderSlider("🧪 Produto", produto, setProduto)}
      {renderSlider("📣 Marketing", marketing, setMarketing)}
      {renderSlider("🏭 Capacidade", capacidade, setCapacidade)}
      {renderSlider("👥 Equipe", equipe, setEquipe)}
      {renderSlider("🎁 Benefício", beneficio, setBeneficio)}

      <p
        style={{
          marginTop: "1rem",
          color: saldoRestante < 0 ? "red" : "#2e7d32",
          fontWeight: "bold",
        }}
      >
        💰 Saldo restante: R$ {saldoRestante.toLocaleString("pt-BR")}
      </p>

      <button
        onClick={handleSalvar}
        disabled={saldoRestante < 0}
        style={{
          marginTop: "1rem",
          padding: "0.6rem 1.2rem",
          fontSize: "1rem",
          backgroundColor: saldoRestante < 0 ? "#ccc" : "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: saldoRestante < 0 ? "not-allowed" : "pointer",
          opacity: saldoRestante < 0 ? 0.6 : 1,
        }}
      >
        💾 Salvar Decisões
      </button>

      {mensagem && (
        <p style={{ marginTop: "1rem", fontWeight: "bold" }}>{mensagem}</p>
      )}
    </div>
  );
}

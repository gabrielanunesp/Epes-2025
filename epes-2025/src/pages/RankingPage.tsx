import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Empresa {
  nome: string;
  missao: string;
  cor: string;
  logoUrl: string;
  criadoPor: string;
}

interface Time {
  caixaAcumulado: number;
  lucroTotal: number;
  rodadasConcluidas: number;
  satisfacaoMedia: number;
  complianceScore: number;
}

interface TimeComScore extends Time {
  scoreEPES: number;
  empresa: Empresa;
  isMeuTime: boolean;
}

export default function RankingPage() {
  const navigate = useNavigate();
  const [usuarioLogado, setUsuarioLogado] = useState<typeof auth.currentUser>(null);
  const [ranking, setRanking] = useState<TimeComScore[]>([]);
  const [codigoTurma, setCodigoTurma] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuarioLogado(user);
    });

    const turma = localStorage.getItem("codigoTurma");
    setCodigoTurma(turma);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const carregarRanking = async () => {
      if (!codigoTurma || !usuarioLogado) return;

      try {
        const empresaRef = doc(db, "empresas", codigoTurma);
        const empresaSnap = await getDoc(empresaRef);
        const empresaData = empresaSnap.exists()
          ? (empresaSnap.data() as Empresa)
          : {
              nome: "Minha Empresa",
              missao: "Missão de teste",
              cor: "#ff9900",
              logoUrl: "",
              criadoPor: usuarioLogado?.uid ?? "simulado",
            };

        const timeRef = doc(db, "times", codigoTurma);
        const timeSnap = await getDoc(timeRef);
        const timeData = timeSnap.exists()
          ? (timeSnap.data() as Time)
          : {
              caixaAcumulado: 10000,
              lucroTotal: 5000,
              rodadasConcluidas: 5,
              satisfacaoMedia: 80,
              complianceScore: 90,
            };

        const lucroMedio =
          typeof timeData.lucroTotal === "number" &&
          typeof timeData.rodadasConcluidas === "number" &&
          timeData.rodadasConcluidas > 0
            ? timeData.lucroTotal / timeData.rodadasConcluidas
            : 0;

        const scoreEPES =
          (timeData.caixaAcumulado ?? 0) * 0.4 +
          lucroMedio * 0.3 +
          (timeData.satisfacaoMedia ?? 0) * 0.2 +
          (timeData.complianceScore ?? 0) * 0.1;

        const timeComScore: TimeComScore = {
          ...timeData,
          scoreEPES,
          empresa: empresaData,
          isMeuTime: true,
        };

        const timesFicticios: TimeComScore[] = [
          {
            caixaAcumulado: 8000,
            lucroTotal: 4000,
            rodadasConcluidas: 4,
            satisfacaoMedia: 75,
            complianceScore: 85,
            scoreEPES: 8000 * 0.4 + (4000 / 4) * 0.3 + 75 * 0.2 + 85 * 0.1,
            empresa: {
              nome: "TechNova",
              missao: "Inovar com propósito",
              cor: "#007bff",
              logoUrl: "",
              criadoPor: "fake1",
            },
            isMeuTime: false,
          },
          {
            caixaAcumulado: 6000,
            lucroTotal: 3000,
            rodadasConcluidas: 3,
            satisfacaoMedia: 70,
            complianceScore: 80,
            scoreEPES: 6000 * 0.4 + (3000 / 3) * 0.3 + 70 * 0.2 + 80 * 0.1,
            empresa: {
              nome: "EcoFuturo",
              missao: "Sustentabilidade em ação",
              cor: "#28a745",
              logoUrl: "",
              criadoPor: "fake2",
            },
            isMeuTime: false,
          },
        ];

        const lista: TimeComScore[] = [timeComScore, ...timesFicticios];

        lista.sort((a, b) => {
          if (b.scoreEPES !== a.scoreEPES) return b.scoreEPES - a.scoreEPES;
          if (b.caixaAcumulado !== a.caixaAcumulado) return b.caixaAcumulado - a.caixaAcumulado;
          return b.satisfacaoMedia - a.satisfacaoMedia;
        });

        setRanking(lista);
      } catch (error) {
        console.error("Erro ao carregar ranking:", error);
      }
    };

    carregarRanking();
  }, [codigoTurma, usuarioLogado]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🏆 Ranking dos Times</h1>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {ranking.map((time, index) => (
          <li
            key={index}
            style={{
              backgroundColor: time.isMeuTime ? "#ffeeba" : "transparent",
              border: time.isMeuTime ? "2px solid #ffc107" : "none",
              padding: "1rem",
              marginBottom: "1rem",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              {time.empresa.logoUrl && (
                <img
                  src={time.empresa.logoUrl}
                  alt={`Logo da ${time.empresa.nome}`}
                  width={40}
                  style={{ marginRight: "1rem" }}
                />
              )}
              <div>
                <strong>{index + 1}.</strong>{" "}
                <span style={{ color: time.empresa.cor }}>
                  {time.empresa.nome}
                </span>{" "}
                — Score EPES: {typeof time.scoreEPES === "number" ? time.scoreEPES.toFixed(2) : "0.00"}
                {time.isMeuTime && <span> 👈 Você</span>}
              </div>
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              <p>📦 Caixa: {typeof time.caixaAcumulado === "number" ? time.caixaAcumulado.toFixed(2) : "0.00"}</p>
              <p>
                💰 Lucro Médio:{" "}
                {typeof time.lucroTotal === "number" &&
                typeof time.rodadasConcluidas === "number" &&
                time.rodadasConcluidas > 0
                  ? (time.lucroTotal / time.rodadasConcluidas).toFixed(2)
                  : "0.00"}
              </p>
              <p>😊 Satisfação: {typeof time.satisfacaoMedia === "number" ? time.satisfacaoMedia.toFixed(2) : "0.00"}</p>
              <p>✅ Compliance: {typeof time.complianceScore === "number" ? time.complianceScore.toFixed(2) : "0.00"}</p>
            </div>
          </li>
        ))}
      </ul>

      {ranking.length === 0 && (
        <p style={{ marginTop: "2rem", fontStyle: "italic", color: "#666" }}>
          Nenhum time foi registrado ainda. Crie uma empresa e comece a jogar para aparecer no ranking!
        </p>
      )}

      <button onClick={() => navigate("/dashboard")}>← Voltar</button>
    </div>
  );
}

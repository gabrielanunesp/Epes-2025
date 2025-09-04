import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Empresa {
  nome: string;
  missao: string;
  cor: string;
  logoUrl: string;
  criadoPor: string;
}

interface Time {
  caixaAcumulado?: number;
  lucroTotal?: number;
  rodadasConcluidas?: number;
  satisfacaoMedia?: number;
  complianceScore?: number;
  criadoPor: string;
  id: string;
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
        const timesSnap = await getDocs(collection(db, "times"));
        const lista: TimeComScore[] = [];

        for (const docSnap of timesSnap.docs) {
          const timeData = docSnap.data() as Time;

          if (timeData.id !== codigoTurma) continue;

          const empresaQuery = query(
            collection(db, "empresas"),
            where("criadoPor", "==", timeData.criadoPor)
          );
          const empresaSnap = await getDocs(empresaQuery);

          const empresaData = empresaSnap.docs.length > 0
            ? (empresaSnap.docs[0].data() as Empresa)
            : {
                nome: "Empresa sem nome",
                missao: "",
                cor: "#ccc",
                logoUrl: "",
                criadoPor: timeData.criadoPor,
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

          lista.push({
            ...timeData,
            scoreEPES,
            empresa: empresaData,
            isMeuTime: timeData.criadoPor === usuarioLogado.uid,
          });
        }

        lista.sort((a, b) => {
          if (b.scoreEPES !== a.scoreEPES) return b.scoreEPES - a.scoreEPES;
          if ((b.caixaAcumulado ?? 0) !== (a.caixaAcumulado ?? 0)) return (b.caixaAcumulado ?? 0) - (a.caixaAcumulado ?? 0);
          return (b.satisfacaoMedia ?? 0) - (a.satisfacaoMedia ?? 0);
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
        {ranking.map((time, index) => {
          const dadosZerados =
            (time.caixaAcumulado ?? 0) === 0 &&
            (time.lucroTotal ?? 0) === 0 &&
            (time.rodadasConcluidas ?? 0) === 0 &&
            (time.satisfacaoMedia ?? 0) === 0 &&
            (time.complianceScore ?? 0) === 0;

          if (dadosZerados) {
            return (
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
                <p style={{ fontStyle: "italic", color: "#888" }}>
                  Os dados ainda não foram registrados. Assim que a rodada acontecer e as decisões forem salvas, o desempenho aparecerá aqui!
                </p>
              </li>
            );
          }

          return (
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
                  — Score EPES: {time.scoreEPES.toFixed(2)}
                  {time.isMeuTime && <span> 👈 Você</span>}
                </div>
              </div>

              <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                <p>📦 Caixa: {time.caixaAcumulado?.toFixed(2) ?? "0.00"}</p>
                <p>
                  💰 Lucro Médio:{" "}
                  {typeof time.lucroTotal === "number" &&
                  typeof time.rodadasConcluidas === "number" &&
                  time.rodadasConcluidas > 0
                    ? (time.lucroTotal / time.rodadasConcluidas).toFixed(2)
                    : "0.00"}
                </p>
                <p>😊 Satisfação: {time.satisfacaoMedia?.toFixed(2) ?? "0.00"}</p>
                <p>✅ Compliance: {time.complianceScore?.toFixed(2) ?? "0.00"}</p>
              </div>
            </li>
          );
        })}
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

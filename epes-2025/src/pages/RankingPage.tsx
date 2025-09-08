import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../services/firebase";

interface Time {
  id: string;
  nome: string;
  caixaAcumulado?: number;
  lucroTotal?: number;
  rodadasConcluidas?: number;
  satisfacaoMedia?: number;
  complianceScore?: number;
  scoreEPES?: number;
}

interface Rodada {
  lucro?: number;
  satisfacao?: number;
  caixaFinal?: number;
  status?: string;
  decisaoForaDoPrazo?: boolean;
  atraso?: boolean;
  timeId: string;
}

const RankingPage: React.FC = () => {
  const [ranking, setRanking] = useState<Time[]>([]);
  const criadoPor = "JViYshnSwJh3LoWqS9Dod3I8dPQ2"; // Substitua pelo UID do administrador

  useEffect(() => {
    atualizarRanking();
  }, []);

  const atualizarRanking = async () => {
    const timesQuery = query(
      collection(db, "times"),
      where("criadoPor", "==", criadoPor)
    );

    const timesSnap = await getDocs(timesQuery);
    const times = timesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Time[];

    const timesAtualizados: Time[] = [];

    for (const time of times) {
      const dadosAtualizados = await calcularScoreDoTime(time.id);
      if (dadosAtualizados) {
        timesAtualizados.push({ ...time, ...dadosAtualizados });
      }
    }

    timesAtualizados.sort((a, b) => {
      const scoreDiff = (b.scoreEPES ?? 0) - (a.scoreEPES ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      const caixaDiff = (b.caixaAcumulado ?? 0) - (a.caixaAcumulado ?? 0);
      if (caixaDiff !== 0) return caixaDiff;

      return (b.satisfacaoMedia ?? 0) - (a.satisfacaoMedia ?? 0);
    });

    setRanking(timesAtualizados);
  };

  const calcularScoreDoTime = async (timeId: string) => {
    try {
      const rodadasQuery = query(
        collection(db, "rodadas"),
        where("timeId", "==", timeId)
      );

      const rodadasSnap = await getDocs(rodadasQuery);
      const rodadas = rodadasSnap.docs.map(doc => doc.data() as Rodada);

      let totalLucro = 0;
      let totalSatisfacao = 0;
      let rodadasValidas = 0;
      let rodadasComCompliance = 0;
      let caixaFinal = 0;

      for (const rodada of rodadas) {
        const lucro = rodada.lucro ?? 0;
        const satisfacao = rodada.satisfacao ?? 0;
        const caixa = rodada.caixaFinal ?? 0;
        const status = rodada.status ?? "❌";

        totalLucro += lucro;
        totalSatisfacao += satisfacao;
        caixaFinal = caixa;
        rodadasValidas++;

        const isCompliant =
          status === "✅" &&
          caixa >= 0 &&
          !rodada.decisaoForaDoPrazo &&
          !rodada.atraso;

        if (isCompliant) rodadasComCompliance++;
      }

      const lucroMedio = rodadasValidas > 0 ? totalLucro / rodadasValidas : 0;
      const satisfacaoMedia = rodadasValidas > 0 ? totalSatisfacao / rodadasValidas : 0;
      const complianceScore = rodadasValidas > 0 ? (rodadasComCompliance / rodadasValidas) * 100 : 0;

      const scoreEPES =
        caixaFinal * 0.4 +
        lucroMedio * 0.3 +
        satisfacaoMedia * 0.2 +
        complianceScore * 0.1;

      const timeRef = doc(db, "times", timeId);
      await updateDoc(timeRef, {
        caixaAcumulado: caixaFinal,
        lucroTotal: totalLucro,
        rodadasConcluidas: rodadasValidas,
        satisfacaoMedia,
        complianceScore,
        scoreEPES,
      });

      return {
        caixaAcumulado: caixaFinal,
        lucroTotal: totalLucro,
        rodadasConcluidas: rodadasValidas,
        satisfacaoMedia,
        complianceScore,
        scoreEPES,
      };
    } catch (error) {
      console.error("Erro ao calcular Score EPES:", error);
      return null;
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🏆 Ranking EPES</h1>
      <p>
        <strong>Critérios:</strong> 40% Caixa • 30% Lucro Médio • 20% Satisfação • 10% Compliance<br />
        <strong>Desempate:</strong> Caixa &gt; Satisfação
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th>#</th>
            <th>Time</th>
            <th>Score EPES</th>
            <th>Caixa</th>
            <th>Lucro</th>
            <th>Satisfação</th>
            <th>Compliance</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((time, index) => (
            <tr key={time.id} style={{ textAlign: "center", borderBottom: "1px solid #ccc" }}>
              <td>{index + 1}</td>
              <td>{time.nome}</td>
              <td>{time.scoreEPES?.toFixed(2)}</td>
              <td>{time.caixaAcumulado}</td>
              <td>{time.lucroTotal}</td>
              <td>{time.satisfacaoMedia?.toFixed(1)}</td>
              <td>{time.complianceScore?.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingPage;

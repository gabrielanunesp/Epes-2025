import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
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
  const [liberarFinal, setLiberarFinal] = useState(false);
  const [rodadaAtual, setRodadaAtual] = useState<number>(1);

  useEffect(() => {
    const docRef = doc(db, "controleRodada", "status");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setLiberarFinal(docSnap.data().liberarFinal);
        setRodadaAtual(docSnap.data().rodadaAtual || 1);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    atualizarRanking();
  }, [liberarFinal, rodadaAtual]);

  const atualizarRanking = async () => {
    const timesSnap = await getDocs(collection(db, "times"));
    const times = timesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Time[];

    const rodadasSnap = await getDocs(collection(db, "rodadas"));
    const todasRodadas = rodadasSnap.docs.map(doc => doc.data() as Rodada);

    const timesAtualizados: Time[] = [];

    for (const time of times) {
      const rodadasDoTime = todasRodadas.filter(r => r.timeId === time.id);

      let totalLucro = 0;
      let totalSatisfacao = 0;
      let rodadasValidas = 0;
      let rodadasComCompliance = 0;
      let caixaFinal = 0;

      for (const rodada of rodadasDoTime) {
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

      await updateDoc(doc(db, "times", time.id), {
        caixaAcumulado: caixaFinal,
        lucroTotal: totalLucro,
        rodadasConcluidas: rodadasValidas,
        satisfacaoMedia,
        complianceScore,
        scoreEPES,
      });

      timesAtualizados.push({
        ...time,
        caixaAcumulado: caixaFinal,
        lucroTotal: totalLucro,
        rodadasConcluidas: rodadasValidas,
        satisfacaoMedia,
        complianceScore,
        scoreEPES,
      });
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
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((time, index) => (
            <tr key={time.id} style={{ textAlign: "center", borderBottom: "1px solid #ccc" }}>
              <td>{index + 1}</td>
              <td>{time.nome || time.id}</td>
              <td>{time.scoreEPES?.toFixed(2)}</td>
              <td>{time.caixaAcumulado}</td>
              <td>{time.lucroTotal}</td>
              <td>{time.satisfacaoMedia?.toFixed(1)}</td>
              <td>{time.complianceScore?.toFixed(1)}%</td>
              <td>
                {time.rodadasConcluidas === 0 || time.scoreEPES === 0
                  ? "⏳ Aguardando participação"
                  : "✅ Ativo"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingPage;

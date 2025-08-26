import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import "./RankingPage.css";

interface Item {
  nome: string;
  pontuacao: number;
}

interface ResultadoRodada {
  turmaId: string;
  pontuacao: number;
}

const RankingPage: React.FC = () => {
  const [jogadores, setJogadores] = useState<Item[]>([]);
  const [times, setTimes] = useState<Item[]>([]);
  const [resultadosRodada, setResultadosRodada] = useState<ResultadoRodada[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const jogadoresSnapshot = await getDocs(collection(db, "jogadores"));
        const timesSnapshot = await getDocs(collection(db, "times"));
        const decisoesSnapshot = await getDocs(collection(db, "decisoes"));

        const jogadoresData = jogadoresSnapshot.docs.map((doc) => doc.data() as Item);
        const timesData = timesSnapshot.docs.map((doc) => doc.data() as Item);

        setJogadores(jogadoresData.sort((a, b) => b.pontuacao - a.pontuacao));
        setTimes(timesData.sort((a, b) => b.pontuacao - a.pontuacao));

        // Agrupar pontuação por turma com validação
        const pontuacaoPorTurma: Record<string, number> = {};

        decisoesSnapshot.docs.forEach((doc) => {
          const data = doc.data();

          const turmaId = typeof data.codigoturma === "string" ? data.codigoturma.trim() : null;
          const pontos = typeof data.creditAvailable === "number" ? data.creditAvailable : 0;

          if (turmaId && turmaId !== "") {
            pontuacaoPorTurma[turmaId] = (pontuacaoPorTurma[turmaId] || 0) + pontos;
          } else {
            // Ignora documentos inválidos silenciosamente
            console.warn("Documento ignorado por falta de codigoturma:", data);
          }
        });

        const resultados: ResultadoRodada[] = Object.entries(pontuacaoPorTurma).map(
          ([turmaId, pontuacao]) => ({
            turmaId,
            pontuacao,
          })
        );

        setResultadosRodada(resultados);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="ranking-container">
      <h1>🏆 Ranking Geral</h1>

      {loading ? (
        <p>Carregando dados...</p>
      ) : (
        <>
          <h2>👥 Jogadores</h2>
          <ul>
            {jogadores.map((jogador, index) => (
              <li key={index}>
                {jogador.nome} — {jogador.pontuacao} pontos
              </li>
            ))}
          </ul>

          <h2>🏟️ Times</h2>
          <ul>
            {times.map((time, index) => (
              <li key={index}>
                {time.nome} — {time.pontuacao} pontos
              </li>
            ))}
          </ul>

          <h2>📊 Rodada Atual (baseada em decisões)</h2>
          <ul>
            {resultadosRodada.map((resultado, index) => (
              <li key={index}>
                Turma {resultado.turmaId} — {resultado.pontuacao} pontos
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default RankingPage;

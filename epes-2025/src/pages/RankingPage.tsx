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

interface Rodada {
  timeId: string;
  pontuacaoRodada: number;
  vitoria: boolean;
  timestamp: string;
}

const RankingPage: React.FC = () => {
  const [jogadores, setJogadores] = useState<Item[]>([]);
  const [times, setTimes] = useState<Item[]>([]);
  const [resultadosRodada, setResultadosRodada] = useState<ResultadoRodada[]>([]);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const jogadoresSnapshot = await getDocs(collection(db, "jogadores"));
        const timesSnapshot = await getDocs(collection(db, "times"));
        const decisoesSnapshot = await getDocs(collection(db, "decisoes"));
        const rodadasSnapshot = await getDocs(collection(db, "rodadas"));

        const jogadoresData = jogadoresSnapshot.docs.map((doc) => doc.data() as Item);
        const timesData = timesSnapshot.docs.map((doc) => doc.data() as Item);

        setJogadores(jogadoresData.sort((a, b) => b.pontuacao - a.pontuacao));
        setTimes(timesData.sort((a, b) => b.pontuacao - a.pontuacao));

        // ✅ Filtrar apenas decisões feitas (com pontuação válida)
        const decisoesFeitas = decisoesSnapshot.docs
          .map((doc) => doc.data())
          .filter((data) => typeof data.creditAvailable === "number" && data.creditAvailable > 0);

        const pontuacaoPorTurma: Record<string, number> = {};

        decisoesFeitas.forEach((data) => {
          const turmaId = typeof data.codigoturma === "string" ? data.codigoturma.trim() : null;
          const pontos = data.creditAvailable;

          if (turmaId && turmaId !== "") {
            pontuacaoPorTurma[turmaId] = (pontuacaoPorTurma[turmaId] || 0) + pontos;
          }
        });

        const resultados: ResultadoRodada[] = Object.entries(pontuacaoPorTurma).map(
          ([turmaId, pontuacao]) => ({
            turmaId,
            pontuacao,
          })
        );

        setResultadosRodada(resultados);

        // 📅 Histórico de rodadas
        const rodadasData: Rodada[] = rodadasSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            timeId: data.timeId || "desconhecido",
            pontuacaoRodada: data.pontuacaoRodada || 0,
            vitoria: data.vitoria || false,
            timestamp: data.timestamp?.toDate().toLocaleString("pt-BR") || "sem data",
          };
        });

        // Ordenar por data mais recente
        rodadasData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRodadas(rodadasData);
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
                {time.nome} — {time.pontuacao ? `${time.pontuacao} pontos` : "⏳ aguardando decisão"}
              </li>
            ))}
          </ul>

          <ul>
            {resultadosRodada.map((resultado, index) => (
              <li key={index}>
                Turma {resultado.turmaId} — {resultado.pontuacao} pontos
              </li>
            ))}
          </ul>

          <h2>📅 Histórico de Rodadas</h2>
          <ul>
            {rodadas
              .filter((r) => r.timeId !== "desconhecido" && r.pontuacaoRodada > 0)
              .map((rodada, index) => (
                <li key={index}>
                  <strong>{rodada.timestamp}</strong> — Time <strong>{rodada.timeId}</strong> marcou <strong>{rodada.pontuacaoRodada}</strong> pontos {rodada.vitoria ? "🏆 Vitória" : "⚔️ Derrota"}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default RankingPage;

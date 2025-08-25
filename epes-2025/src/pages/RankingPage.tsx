import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase"; // ajuste o caminho se necessário
import "./RankingPage.css";

interface Item {
  nome: string;
  pontuacao: number;
}

const RankingPage: React.FC = () => {
  const [jogadores, setJogadores] = useState<Item[]>([]);
  const [times, setTimes] = useState<Item[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const jogadoresSnapshot = await getDocs(collection(db, "jogadores"));
        const timesSnapshot = await getDocs(collection(db, "times"));

        const jogadoresData = jogadoresSnapshot.docs.map((doc) => doc.data() as Item);
        const timesData = timesSnapshot.docs.map((doc) => doc.data() as Item);

        // Ordenar por pontuação decrescente
        setJogadores(jogadoresData.sort((a, b) => b.pontuacao - a.pontuacao));
        setTimes(timesData.sort((a, b) => b.pontuacao - a.pontuacao));
      } catch (error) {
        console.error("Erro ao buscar dados do ranking:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="ranking-container">
      <h2 className="ranking-title">🏆 Ranking Geral</h2>

      <section className="ranking-section">
        <h3 className="ranking-subtitle">👤 Jogadores</h3>
        <ul className="ranking-list">
          {jogadores.map((jogador, index) => (
            <li key={index} className="ranking-item">
              <span className="ranking-position">{index + 1}º</span>
              <span className="ranking-name">{jogador.nome}</span>
              <span className="ranking-score">{jogador.pontuacao} pts</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="ranking-section">
        <h3 className="ranking-subtitle">👥 Times</h3>
        <ul className="ranking-list team-list">
          {times.map((time, index) => (
            <li key={index} className="ranking-item team-item">
              <span className="ranking-position">{index + 1}º</span>
              <span className="ranking-name">{time.nome}</span>
              <span className="ranking-score">{time.pontuacao} pts</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default RankingPage;

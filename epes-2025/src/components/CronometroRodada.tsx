import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface Props {
  modo: "adm" | "jogador";
}

export default function CronometroRodada({ modo }: Props) {
  const [tempoRestante, setTempoRestante] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    const configRef = doc(db, "configuracoes", "geral");

    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      const dados = docSnap.data();
      if (dados?.rodadaAtiva && dados?.prazo) {
        setAtivo(true);
        const fimTimestamp = dados.prazo.toDate().getTime();
        iniciarContagem(fimTimestamp);
      } else {
        setAtivo(false);
        setTempoRestante(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const iniciarContagem = (fim: number) => {
    const intervalo = setInterval(() => {
      const agora = Date.now();
      const restante = fim - agora;

      if (restante <= 0) {
        if (modo === "jogador") {
          setTempoRestante("🚦 Aguardando início da próxima rodada.");
        } else {
          setTempoRestante(null); // ADM não vê essa mensagem
        }
        clearInterval(intervalo);
        return;
      }

      const horas = Math.floor(restante / (1000 * 60 * 60));
      const minutos = Math.floor((restante % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((restante % (1000 * 60)) / 1000);

      setTempoRestante(
        `${horas.toString().padStart(2, "0")}:${minutos
          .toString()
          .padStart(2, "0")}:${segundos.toString().padStart(2, "0")}`
      );
    }, 1000);
  };

  if (!ativo || !tempoRestante) return null;

  return (
    <div className="cronometro-rodada">
      {tempoRestante === "🚦 Aguardando início da próxima rodada." ? (
        <p>{tempoRestante}</p>
      ) : (
        <p>⏳ Tempo restante: <strong>{tempoRestante}</strong></p>
      )}
    </div>
  );
}

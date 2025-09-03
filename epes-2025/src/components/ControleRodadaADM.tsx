import React, { useState } from "react";
import { db } from "../services/firebase";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

export default function ControleRodadaADM() {
  const [numeroRodada, setNumeroRodada] = useState<number>(1);
  const [valorPremio, setValorPremio] = useState<number>(500);

  const iniciarRodada = async () => {
    const agora = new Date();
    const fim = new Date();
    fim.setHours(23, 59, 0, 0);

    const configRef = doc(db, "configuracoes", "geral");
    await updateDoc(configRef, {
      rodadaAtiva: true,
      rodadaAtual: numeroRodada,
      prazo: Timestamp.fromDate(fim),
      premio: valorPremio,
    });

    alert("✅ Rodada iniciada com sucesso!");
  };

  const encerrarRodada = async () => {
    const configRef = doc(db, "configuracoes", "geral");
    const configSnap = await getDoc(configRef);
    const dados = configSnap.data();

    if (!dados?.rodadaAtiva) {
      alert("⚠️ Nenhuma rodada ativa para encerrar.");
      return;
    }

    const rodadaFinalizada = {
      numero: dados.rodadaAtual,
      premio: dados.premio || 0,
      inicio: dados.prazo.toDate(),
      fim: new Date(new Date().setHours(23, 59, 0, 0)),
      encerradaEm: new Date(),
    };

    await addDoc(collection(db, "rodadas"), rodadaFinalizada);
    await updateDoc(configRef, { rodadaAtiva: false });

    alert("📦 Rodada encerrada e salva com sucesso!");
  };

  return (
    <div className="controle-rodada">
      <h3>🎮 Controle de Rodada</h3>
      <input
        type="number"
        value={numeroRodada}
        onChange={(e) => setNumeroRodada(Number(e.target.value))}
        placeholder="Número da rodada"
      />
      <input
        type="number"
        value={valorPremio}
        onChange={(e) => setValorPremio(Number(e.target.value))}
        placeholder="Valor do prêmio"
      />
      <button onClick={iniciarRodada}>▶️ Iniciar Rodada</button>
      <button onClick={encerrarRodada}>⏹️ Encerrar Rodada</button>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const DecisionTools = () => {
  const [user, setUser] = useState<any>(null);
  const [dadosRodada, setDadosRodada] = useState<any>(null);
  const [tempoRestante, setTempoRestante] = useState<number>(0);
  const [mensagemOrientacao, setMensagemOrientacao] = useState<boolean>(false);
  const [capitaoId, setCapitaoId] = useState<string | null>(null);

  // Autenticação direta
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Busca do capitão via documento do time
  useEffect(() => {
    const fetchCapitao = async () => {
      const codigoTurma = localStorage.getItem('codigoTurma');
      if (!codigoTurma) return;

      const timeRef = doc(db, 'times', codigoTurma);
      const timeSnap = await getDoc(timeRef);
      const timeData = timeSnap.data();

      if (timeData?.criadoPor) {
        setCapitaoId(timeData.criadoPor);
      }
    };

    fetchCapitao();
  }, []);

  // Escuta da rodada atual
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rodadas', 'rodadaAtual'), (docSnap) => {
      if (docSnap.exists()) {
        setDadosRodada(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // Cronômetro baseado no timestamp salvo
  useEffect(() => {
    if (!dadosRodada?.rodadaIniciada || !dadosRodada?.inicioTimestamp) return;

    const fimDoDia = new Date();
    fimDoDia.setHours(23, 59, 0, 0);
    const diferenca = Math.max(
      0,
      Math.floor((fimDoDia.getTime() - dadosRodada.inicioTimestamp) / 1000)
    );
    setTempoRestante(diferenca);

    const intervalo = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          updateDoc(doc(db, 'rodadas', 'rodadaAtual'), {
            tempoEsgotado: true,
            rodadaIniciada: false
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [dadosRodada]);

  const iniciarRodada = async () => {
    const timestamp = Date.now();
    await setDoc(doc(db, 'rodadas', 'rodadaAtual'), {
      rodada: dadosRodada?.rodada || 1,
      rodadaIniciada: true,
      tempoEsgotado: false,
      inicioTimestamp: timestamp
    });
    setMensagemOrientacao(false);
  };

  const avancarRodada = async () => {
    if (dadosRodada.rodada < 10) {
      await updateDoc(doc(db, 'rodadas', 'rodadaAtual'), {
        rodada: dadosRodada.rodada + 1,
        rodadaIniciada: false,
        tempoEsgotado: false,
        inicioTimestamp: null
      });
      setMensagemOrientacao(true);
    } else {
      alert('🏁 Todas as 10 rodadas foram concluídas!');
    }
  };

  const formatarTempo = (segundos: number) => {
    const h = Math.floor(segundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((segundos % 3600) / 60).toString().padStart(2, '0');
    const s = (segundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const isCapitao = user?.uid === capitaoId;

  if (!user) return <p>🔒 Você precisa estar logada para acessar as decisões.</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
      <h2>🕒 Rodada {dadosRodada?.rodada || 1}</h2>

      {!dadosRodada?.rodadaIniciada && !dadosRodada?.tempoEsgotado && isCapitao && (
        <button
          onClick={iniciarRodada}
          style={{
            marginBottom: '20px',
            padding: '10px 16px',
            fontSize: '16px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ▶️ Iniciar rodada
        </button>
      )}

      {dadosRodada?.rodadaIniciada && (
        <div style={{
          fontSize: '48px',
          backgroundColor: '#000',
          color: '#0f0',
          padding: '20px',
          borderRadius: '12px',
          width: '250px',
          margin: '0 auto',
          boxShadow: '0 0 10px #0f0',
        }}>
          {formatarTempo(tempoRestante)}
        </div>
      )}

      {dadosRodada?.tempoEsgotado && isCapitao && (
        <button
          onClick={avancarRodada}
          style={{
            marginTop: '20px',
            padding: '10px 16px',
            fontSize: '16px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ✅ Avançar para próxima rodada
        </button>
      )}

      {dadosRodada?.tempoEsgotado && !isCapitao && (
        <p style={{ marginTop: '20px', color: '#f44336', fontWeight: 'bold' }}>
          ⛔ Tempo encerrado. Aguarde o capitão iniciar a próxima rodada.
        </p>
      )}

      {mensagemOrientacao && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '8px',
          fontWeight: 'bold',
          maxWidth: '400px',
          margin: '20px auto'
        }}>
          ✅ Rodada iniciada! Volte para a página de decisões e faça suas escolhas.  
          O tempo continuará correndo.  
          Quando ele acabar, não será mais possível escolher.  
          Apenas o capitão poderá iniciar a próxima rodada.
        </div>
      )}
    </div>
  );
};

export default DecisionTools;

import { db } from './firebase';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  addDoc,
  arrayUnion
} from 'firebase/firestore';

export const iniciarRodada = async (numero: number, valorPremio: number) => {
  const timestamp = Date.now();

  await setDoc(doc(db, 'rodadas', 'rodadaAtual'), {
    rodada: numero,
    rodadaIniciada: true,
    tempoEsgotado: false,
    inicioTimestamp: timestamp,
    valorPremio,
    vitoria: false,
    decisoesRecebidas: []
  });
};

export const encerrarRodada = async () => {
  const rodadaRef = doc(db, 'rodadas', 'rodadaAtual');
  const dados = (await getDoc(rodadaRef)).data();

  if (!dados) return;

  await addDoc(collection(db, 'rodadas'), dados);

  await updateDoc(rodadaRef, {
    rodadaIniciada: false,
    tempoEsgotado: true
  });
};

export const registrarDecisao = async (uid: string) => {
  await updateDoc(doc(db, 'rodadas', 'rodadaAtual'), {
    decisoesRecebidas: arrayUnion(uid)
  });
};

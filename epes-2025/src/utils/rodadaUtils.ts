import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";

export async function gerarRodada(db: any, numeroRodada: number) {
  const decisoesRef = collection(db, "decisoes");
  const snapshot = await getDocs(decisoesRef);

  const pontuacaoPorTurma: Record<string, number> = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const turmaId = data.codigoturma;
    const pontuacao = Number(data.creditAvailable);

    // Validação: ignora se faltar dados
    if (!turmaId || isNaN(pontuacao)) return;

    if (!pontuacaoPorTurma[turmaId]) {
      pontuacaoPorTurma[turmaId] = 0;
    }
    pontuacaoPorTurma[turmaId] += pontuacao;
  });

  if (Object.keys(pontuacaoPorTurma).length === 0) {
    console.warn("Nenhuma pontuação válida encontrada para gerar rodada.");
    return;
  }

  const maiorPontuacao = Math.max(...Object.values(pontuacaoPorTurma));

  const resultados = Object.entries(pontuacaoPorTurma).map(([turmaId, pontuacaoRodada]) => ({
    timeId: turmaId,
    pontuacaoRodada,
    vitoria: pontuacaoRodada === maiorPontuacao
  }));

  await addDoc(collection(db, "rodadas"), {
    numero: numeroRodada,
    data: Timestamp.now(),
    resultados
  });

  console.log(`Rodada ${numeroRodada} salva com sucesso!`);
}

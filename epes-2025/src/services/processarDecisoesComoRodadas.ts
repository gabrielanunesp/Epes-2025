import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export const processarDecisoesComoRodadas = async () => {
  const snap = await getDocs(collection(db, "decisoes"));
  const decisoes = snap.docs.map(doc => doc.data());

  for (const d of decisoes) {
    const {
      produto = 0,
      marketing = 0,
      capacidade = 0,
      equipe = 0,
      beneficio = 0,
      publicoAlvo = "classe-cd",
      caixaAcumulado = 500000,
      codigoTurma: timeId,
      atraso = false,
    } = d;

    if (!timeId) continue;

    let ea = produto * 0.2 + equipe * 0.3 + beneficio * 0.5;
    if (publicoAlvo === "jovens") ea *= 1.1;
    if (publicoAlvo === "classe-cd") ea *= 1.05;
    if (publicoAlvo === "seniores") ea *= 0.95;

    const demanda = ea * 0.02 + marketing * 0.001;
    const precoMedio = 50;
    const receita = demanda * precoMedio;
    const custo = capacidade * 0.3 + equipe * 0.2 + beneficio * 0.2 + marketing * 0.3;
    let lucro = receita - custo;
    if (atraso) lucro *= 0.7;
    const reinvestimento = lucro * 0.2;
    const caixaFinal = caixaAcumulado + lucro - reinvestimento;

    const rodada = {
      timeId,
      ea: Math.round(ea),
      demanda: Math.round(demanda),
      receita: parseFloat(receita.toFixed(2)),
      custo: parseFloat(custo.toFixed(2)),
      lucro: parseFloat(lucro.toFixed(2)),
      reinvestimento: parseFloat(reinvestimento.toFixed(2)),
      caixaFinal: parseFloat(caixaFinal.toFixed(2)),
      satisfacao: Math.min(100, ea / 100),
      atraso,
      status: "✅",
      versao: "2025",
      timestamp: new Date(),
    };

    await addDoc(collection(db, "rodadas"), rodada);
  }
};

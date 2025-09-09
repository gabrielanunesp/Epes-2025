import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "./firebase"; // ajuste o caminho se necessário

// Pontuação por tipo de investimento
const pontosInvestimento: Record<string, number> = {
  Tecnologia: 20,
  Infraestrutura: 25,
  Treinamento: 15,
};

// Pontuação por tipo de marketing
const pontosMarketing: Record<string, number> = {
  Online: 10,
  TV: 20,
  Eventos: 15,
};

// Pontuação por tipo de P&D
const pontosPD: Record<string, number> = {
  Produto: 10,
  Processo: 15,
};

// Bônus por produção
const bonusProducao: Record<number, number> = {
  70: 0,
  100: 50,
};

// Cálculo da satisfação com base nos investimentos
const calcularSatisfacao = (investimentos: string[]) => {
  const qualidade = investimentos.includes("Tecnologia") ? 80 : 50;
  const atendimento = investimentos.includes("Treinamento") ? 70 : 40;
  return Math.min(100, qualidade * 0.6 + atendimento * 0.4);
};

// Função principal para processar decisões e gerar rodadas
export const processarDecisoesComoRodadas = async () => {
  try {
    const snap = await getDocs(collection(db, "decisoes"));
    const decisoes = snap.docs.map(doc => doc.data());

    for (const d of decisoes) {
      // Validação dos campos
      const investimento = Array.isArray(d.investimento) ? d.investimento : [];
      const marketing = Array.isArray(d.marketing) ? d.marketing : [];
      const pd = Array.isArray(d.pd) ? d.pd : [];
      const producao = typeof d.producao === "number" ? d.producao : 70;
      const caixaFinal = typeof d.caixaAcumulado === "number" ? d.caixaAcumulado : 0;
      const timeId = d.codigoTurma;

      if (!timeId) continue; // ignora decisões sem time

      // Cálculo do custo
      const custo =
        investimento.reduce((sum, item) => sum + (pontosInvestimento[item] || 0), 0) +
        marketing.reduce((sum, item) => sum + (pontosMarketing[item] || 0), 0) +
        pd.reduce((sum, item) => sum + (pontosPD[item] || 0), 0);

      // Cálculo da receita
      const receitaBase = 100;
      const receitaExtra =
        (bonusProducao[producao] || 0) +
        pd.reduce((sum, item) => sum + (pontosPD[item] || 0) * 0.5, 0);

      let lucro = receitaBase + receitaExtra - custo;
      if (d.atraso) lucro *= 0.7;

      const satisfacao = calcularSatisfacao(investimento);

      // Criação da rodada
      const rodada = {
        timeId,
        lucro: parseFloat(lucro.toFixed(2)),
        satisfacao: parseFloat(satisfacao.toFixed(1)),
        caixaFinal: parseFloat(caixaFinal.toFixed(2)),
        status: "✅",
        atraso: d.atraso || false,
        decisaoForaDoPrazo: false,
        timestamp: new Date(),
      };

      await addDoc(collection(db, "rodadas"), rodada);
    }

    console.log("✅ Rodadas geradas com sucesso!");
  } catch (error) {
    console.error("Erro ao processar decisões:", error);
  }
};

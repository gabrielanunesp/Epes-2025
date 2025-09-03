import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";

type Decisao = {
  email: string;
  investimento: string[];
  marketing: string[];
  producao: number;
  pd: string[];
  atraso?: boolean;
};

const pontosInvestimento: Record<string, number> = {
  Tecnologia: 20,
  Infraestrutura: 25,
  Treinamento: 15,
};

const pontosMarketing: Record<string, number> = {
  Online: 10,
  TV: 20,
  Eventos: 15,
};

const pontosPD: Record<string, number> = {
  Produto: 10,
  Processo: 15,
};

const bonusProducao: Record<number, number> = {
  70: 0,
  100: 50,
};

const Relatorio: React.FC = () => {
  const [decisoes, setDecisoes] = useState<Decisao[]>([]);

  useEffect(() => {
    const fetchDecisoes = async () => {
      const snapshot = await getDocs(collection(db, "decisoes"));
      const dados = snapshot.docs.map(doc => doc.data() as Decisao);
      setDecisoes(dados);
    };

    fetchDecisoes();
  }, []);

  let caixaAcumulado = 0;
  let reinvestimentoHistorico: boolean[] = [];

  const relatorioFinal = decisoes.map((d, index) => {
    const custo =
      (d.investimento || []).reduce((sum, item) => sum + (pontosInvestimento[item] || 0), 0) +
      (d.marketing || []).reduce((sum, item) => sum + (pontosMarketing[item] || 0), 0) +
      (d.pd || []).reduce((sum, item) => sum + (pontosPD[item] || 0), 0);

    let receitaBase = 100;
    let receitaExtra =
      (bonusProducao[d.producao] || 0) +
      (d.pd || []).reduce((sum, item) => sum + (pontosPD[item] || 0) * 0.5, 0);

    let receitaTotal = receitaBase + receitaExtra;

    // Limite de crescimento: se não houve reinvestimento por 2 rodadas seguidas
    const houveInvestimento = (d.investimento || []).length > 0;
    reinvestimentoHistorico.push(houveInvestimento);
    const ultimos2 = reinvestimentoHistorico.slice(-2);
    const semInvestimentoRecentemente = ultimos2.every(v => !v);

    if (semInvestimentoRecentemente) {
      receitaTotal = Math.min(receitaTotal, 120); // teto de receita
    }

    let lucro = receitaTotal - custo;

    // Penalidade por atraso
    if (d.atraso) {
      lucro *= 0.7; // aplica desconto de 30%
    }

    const reinvestido = lucro * 0.2;
    const caixaRodada = lucro * 0.8;
    caixaAcumulado += caixaRodada;

    const bloqueado = caixaAcumulado < 0;

    return {
      dia: index + 1,
      email: d.email,
      receita: receitaTotal,
      custo,
      lucro,
      reinvestido,
      caixaFinal: caixaAcumulado,
      bloqueado,
      atraso: d.atraso || false,
      tetoReceita: semInvestimentoRecentemente,
    };
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório Financeiro por Rodada</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#eee" }}>
            <th>Dia</th>
            <th>Email</th>
            <th>Receita</th>
            <th>Custo</th>
            <th>Lucro</th>
            <th>Reinvestido</th>
            <th>Caixa Final</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {relatorioFinal.map((r, index) => (
            <tr
              key={index}
              style={{
                backgroundColor: r.bloqueado ? "#ffe6e6" : r.atraso ? "#fff8dc" : "#fff",
              }}
            >
              <td>{r.dia}</td>
              <td>{r.email}</td>
              <td>R$ {r.receita.toFixed(2)}</td>
              <td>R$ {r.custo.toFixed(2)}</td>
              <td>
                R$ {r.lucro.toFixed(2)}
                {r.atraso && " ⚠️ Atraso"}
              </td>
              <td>R$ {r.reinvestido.toFixed(2)}</td>
              <td>R$ {r.caixaFinal.toFixed(2)}</td>
              <td>
                {r.bloqueado
                  ? "🚫 Bloqueado"
                  : r.tetoReceita
                  ? "📉 Receita Limitada"
                  : "✅ Ativo"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Relatorio;

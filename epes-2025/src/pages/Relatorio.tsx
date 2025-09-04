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

const calcularSatisfacao = (investimentos: string[]) => {
  const qualidade = investimentos.includes("Tecnologia") ? 80 : 50;
  const atendimento = investimentos.includes("Treinamento") ? 70 : 40;
  return Math.min(100, qualidade * 0.6 + atendimento * 0.4);
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

  let caixaAcumuladoPorEmail: Record<string, number> = {};
  let lucrosPorEmail: Record<string, number[]> = {};
  let satisfacoesPorEmail: Record<string, number[]> = {};
  let compliancePorEmail: Record<string, number> = {};

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

    const houveInvestimento = (d.investimento || []).length > 0;
    reinvestimentoHistorico.push(houveInvestimento);
    const ultimos2 = reinvestimentoHistorico.slice(-2);
    const semInvestimentoRecentemente = ultimos2.every(v => !v);

    if (semInvestimentoRecentemente) {
      receitaTotal = Math.min(receitaTotal, 120);
    }

    let lucro = receitaTotal - custo;

    if (d.atraso) {
      lucro *= 0.7;
    }

    const reinvestido = lucro * 0.2;
    const caixaRodada = lucro * 0.8;

    // Atualiza caixa acumulado por email
    caixaAcumuladoPorEmail[d.email] = (caixaAcumuladoPorEmail[d.email] || 0) + caixaRodada;

    // Atualiza lucros por email
    if (!lucrosPorEmail[d.email]) lucrosPorEmail[d.email] = [];
    lucrosPorEmail[d.email].push(lucro);

    // Atualiza satisfação por email
    const satisfacao = calcularSatisfacao(d.investimento);
    if (!satisfacoesPorEmail[d.email]) satisfacoesPorEmail[d.email] = [];
    satisfacoesPorEmail[d.email].push(satisfacao);

    // Atualiza compliance
    const penalidade = d.atraso ? 1 : 0;
    compliancePorEmail[d.email] = (compliancePorEmail[d.email] || 0) + penalidade;

    const bloqueado = caixaAcumuladoPorEmail[d.email] < 0;

    return {
      dia: index + 1,
      email: d.email,
      receita: receitaTotal,
      custo,
      lucro,
      reinvestido,
      caixaFinal: caixaAcumuladoPorEmail[d.email],
      satisfacao,
      atraso: d.atraso || false,
      bloqueado,
      tetoReceita: semInvestimentoRecentemente,
    };
  });

  // Cálculo do Score EPES por email
  const scoreEPESPorEmail = Object.keys(caixaAcumuladoPorEmail).map(email => {
    const caixa = caixaAcumuladoPorEmail[email];
    const lucros = lucrosPorEmail[email] || [];
    const satisfacoes = satisfacoesPorEmail[email] || [];
    const complianceErros = compliancePorEmail[email] || 0;
    const totalRodadas = lucros.length;

    const lucroMedio = lucros.reduce((a, b) => a + b, 0) / totalRodadas;
    const satisfacaoMedia = satisfacoes.reduce((a, b) => a + b, 0) / totalRodadas;
    const complianceScore = 10 - complianceErros; // perde 1 ponto por erro

    const scoreEPES =
      caixa * 0.4 +
      lucroMedio * 0.3 +
      satisfacaoMedia * 0.2 +
      complianceScore * 0.1;

    return { email, scoreEPES };
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório Financeiro por Rodada</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
        <thead>
          <tr style={{ backgroundColor: "#eee" }}>
            <th>Dia</th>
            <th>Email</th>
            <th>Receita</th>
            <th>Custo</th>
            <th>Lucro</th>
            <th>Reinvestido</th>
            <th>Caixa Final</th>
            <th>Satisfação</th>
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
              <td>{r.satisfacao.toFixed(1)}%</td>
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

      <h2>🏆 Ranking Final por Score EPES</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#eee" }}>
            <th>Email</th>
            <th>Score EPES</th>
          </tr>
        </thead>
        <tbody>
          {scoreEPESPorEmail
            .sort((a, b) => b.scoreEPES - a.scoreEPES)
            .map((r, index) => (
              <tr key={index}>
                <td>{r.email}</td>
                <td>{r.scoreEPES.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default Relatorio;

import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";

type Decisao = {
  email: string;
  investimento: string[];
  marketing: string[];
  producao: number; // 70 ou 100
  pd: string[];
};

// Pontuação atualizada conforme sua tabela
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

  const decisoesComLucro = decisoes.map((d) => {
    const creditoUsado =
      (d.investimento || []).reduce((sum, item) => sum + (pontosInvestimento[item] || 0), 0) +
      (d.marketing || []).reduce((sum, item) => sum + (pontosMarketing[item] || 0), 0) +
      (d.pd || []).reduce((sum, item) => sum + (pontosPD[item] || 0), 0);

    const receitaBase = 100;
    const receita =
      receitaBase +
      (bonusProducao[d.producao] || 0) +
      (d.pd || []).reduce((sum, item) => sum + (pontosPD[item] || 0) * 0.5, 0);

    const lucro = receita - creditoUsado;

    return { ...d, creditoUsado, receita, lucro };
  });

  const ordenadoPorLucro = [...decisoesComLucro].sort((a, b) => b.lucro - a.lucro);
  const destaque = ordenadoPorLucro[0]?.email;

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório de Decisões</h2>

      {ordenadoPorLucro.map((d, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            backgroundColor: d.email === destaque ? "#f0f8ff" : "#fff",
          }}
        >
          <h3>
            {d.email} {d.email === destaque && "🏆"}
          </h3>

          <p><strong>Investimentos:</strong> {(d.investimento || []).join(", ")}</p>
          <p><strong>Marketing:</strong> {(d.marketing || []).join(", ")}</p>
          <p><strong>Produção:</strong> {d.producao}%</p>
          <p><strong>P&D:</strong> {(d.pd || []).join(", ")}</p>

          <hr />

          <p><strong>Crédito Usado:</strong> {d.creditoUsado} / 100</p>
          <p><strong>Receita Estimada:</strong> R$ {d.receita.toFixed(2)}</p>
          <p><strong>Lucro:</strong> R$ {d.lucro.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
};

export default Relatorio;

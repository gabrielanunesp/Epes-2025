import React from "react";

type Decisao = {
  nome: string;
  investimentos: string[];
  marketing: string[];
  producao: string;
  pd: string[];
};

const nomesFicticios = [
  "Lucas", "Mariana", "João", "Gabriela", "Rafaela", "Carlos", "Fernanda", "Tiago"
];

const opcoesInvestimento = ["Tecnologia", "Expansão", "Treinamento", "Infraestrutura"];
const opcoesMarketing = ["TV", "Online", "Eventos", "Rádio"];
const opcoesProducao = ["70%", "100%"];
const opcoesPD = ["Produto", "Processo"];

const gerarDecisao = (): Decisao => {
  const nome = nomesFicticios[Math.floor(Math.random() * nomesFicticios.length)];
  const investimentos = [opcoesInvestimento[Math.floor(Math.random() * opcoesInvestimento.length)]];
  const marketing = [
    opcoesMarketing[Math.floor(Math.random() * opcoesMarketing.length)],
    opcoesMarketing[Math.floor(Math.random() * opcoesMarketing.length)],
  ];
  const producao = opcoesProducao[Math.floor(Math.random() * opcoesProducao.length)];
  const pd = [
    opcoesPD[Math.floor(Math.random() * opcoesPD.length)],
    Math.random() > 0.5 ? opcoesPD[Math.floor(Math.random() * opcoesPD.length)] : null,
  ].filter(Boolean) as string[];

  return { nome, investimentos, marketing, producao, pd };
};

const Relatorio: React.FC = () => {
  const decisoes: Decisao[] = Array.from({ length: 8 }, () => gerarDecisao());
  const destaque = decisoes[0].nome; // jogador destaque é o primeiro da lista

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório de Decisões</h2>

      {decisoes.map((d, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            backgroundColor: d.nome === destaque ? "#f0f8ff" : "#fff",
          }}
        >
          <h3>
            {d.nome} {d.nome === destaque && "🏆"}
          </h3>

          <p><strong>Investimentos:</strong> {d.investimentos.join(", ")}</p>
          <p><strong>Marketing:</strong> {d.marketing.join(", ")}</p>
          <p><strong>Produção:</strong> {d.producao}</p>
          <p><strong>P&D:</strong> {d.pd.join(", ")}</p>
        </div>
      ))}
    </div>
  );
};

export default Relatorio;

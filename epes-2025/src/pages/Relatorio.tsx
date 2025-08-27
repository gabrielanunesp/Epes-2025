import React from "react";
import "./Relatorio.css";

export default function Relatorio() {
  // Exemplo de dados simulados — no seu sistema real, esses valores viriam de props ou contexto
  const receita = 12000;
  const custos = 7500;
  const lucro = receita - custos;

  return (
    <div className="page-container">
      <h2>📊 Relatório Financeiro</h2>
      <p>Este relatório mostra os principais resultados da sua operação no dia anterior. Use essas informações para ajustar sua estratégia nas próximas rodadas.</p>

      <ul className="report-list">
        <li><strong>Receita:</strong> R$ 12.000  
          <br />💡 Representa o total de vendas realizadas. Influenciada por preço, marketing, qualidade e canais.</li>

        <li><strong>Custos:</strong> R$ 7.500  
          <br />💡 Inclui custos variáveis (produção, atendimento, logística). A eficiência ajuda a reduzir esse valor.</li>

        <li><strong>Lucro:</strong> R$ 4.500  
          <br />💡 Receita menos custos. Parte do lucro pode ser reinvestida em upgrades (qualidade, capacidade, etc.).</li>
      </ul>

      <h2>🧠 Como interpretar o relatório</h2>
      <ul className="report-list">
        <li><strong>Alta receita + baixo lucro:</strong> Pode indicar custos elevados. Reveja eficiência e preço.</li>
        <li><strong>Baixa receita:</strong> Pode ser falta de marketing, preço alto ou atributos mal distribuídos.</li>
        <li><strong>Lucro alto:</strong> Ótimo! Considere reinvestir 20% em melhorias estratégicas.</li>
      </ul>

      <h2>🔁 Próximos passos</h2>
      <ul className="report-list">
        <li>Reajustar o preço para melhorar atração ou margem.</li>
        <li>Investir em atributos que aumentem satisfação e demanda.</li>
        <li>Corrigir gargalos como capacidade ou atendimento.</li>
      </ul>

      <p className="note">Lembre-se: o relatório é seu guia. Decisões bem embasadas levam ao topo do ranking.</p>

      <hr />

      <h2>📌 Seus Resultados</h2>
      <ul className="report-list">
        <li><strong>Receita do dia:</strong> R$ {receita.toLocaleString()}</li>
        <li><strong>Custos totais:</strong> R$ {custos.toLocaleString()}</li>
        <li><strong>Lucro líquido:</strong> R$ {lucro.toLocaleString()}</li>
      </ul>

      <p className="note">Esses valores são calculados com base nas decisões que você tomou na rodada anterior.</p>
    </div>
  );
}

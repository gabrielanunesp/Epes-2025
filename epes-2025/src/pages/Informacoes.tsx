import React from "react";
import "./Informacoes.css";

export default function Informacoes() {
  return (
    <div className="page-container">
      <h2>🎮 Sobre o Jogo</h2>
      <p>Este jogo simula decisões estratégicas em um ambiente empresarial competitivo, onde cada equipe deve lançar e operar um produto ou serviço digital.</p>

      <ul className="info-list">
        <li><strong>Objetivo:</strong> Maximizar o lucro e a satisfação ao longo das rodadas.</li>
        <li><strong>Duração:</strong> 10 dias (D1 = pré-lançamento; D2 a D10 = operação real).</li>
        <li><strong>Rodadas:</strong> Cada dia representa uma nova rodada de decisões que afetam o desempenho do negócio.</li>
        <li><strong>Grupos:</strong> Os jogadores atuam em equipes e competem entre si em um mercado simulado.</li>
      </ul>

      <h2>🧠 Como funcionam os 100 pontos de decisão</h2>
      <p>No início do jogo (D1), cada equipe recebe <strong>100 pontos</strong> para montar sua estratégia inicial. Esses pontos devem ser distribuídos entre diferentes áreas que influenciam diretamente o desempenho do produto.</p>
      <p>O segredo está em equilibrar os investimentos de acordo com o tipo de produto, público-alvo e metas da equipe.</p>

      <ul className="info-list">
        <li><strong>Qualidade:</strong> [■■■■□] (20 pts) → Aumenta a satisfação, mas eleva o custo.</li>
        <li><strong>Eficiência:</strong> [■■■□□] (15 pts) → Reduz os custos variáveis.</li>
        <li><strong>Atendimento:</strong> [■■□□□] (10 pts) → Melhora a satisfação e o ranking.</li>
        <li><strong>Capacidade de entrega:</strong> Define quantas unidades podem ser entregues por dia. Evita atrasos e backlog.</li>
        <li><strong>Canais de venda:</strong> Escolha entre online, presencial ou híbrido. Afeta o alcance e o tipo de cliente.</li>
        <li><strong>Marketing de lançamento:</strong> Aumenta a visibilidade e a demanda inicial.</li>
        <li><strong>P&D inicial:</strong> Garante inovação e pode desbloquear vantagens futuras.</li>
      </ul>

      <h2>📊 Tomando boas decisões</h2>
      <p>Com o tempo, você aprende a ajustar sua estratégia com base nos dados e no comportamento do mercado.</p>

      <h2>✅ Dica Final</h2>
      <p>Os <strong>100 pontos</strong> são sua ferramenta de estratégia. Cada escolha molda o desempenho do seu produto. O jogo recompensa quem pensa com equilíbrio, visão e adaptação.</p>

      <p className="note">Use essas informações a seu favor para tomar decisões mais inteligentes e alcançar os melhores resultados.</p>
    </div>
  );
}

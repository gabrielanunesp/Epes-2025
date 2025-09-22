import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import "./Informacoes.css";

type Rodada = {
  timeId: string;
  ea?: number;
  demanda?: number;
  receita?: number;
  custo?: number;
  lucro?: number;
  reinvestimento?: number;
  caixaFinal?: number;
  satisfacao?: number;
  atraso?: boolean;
  status?: string;
  timestamp?: any;
};

export default function Informacoes() {
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const fetchRodadas = async () => {
      try {
        const codigoTurma = localStorage.getItem("codigoTurma");
        if (!codigoTurma) {
          setErro("❌ Código da turma não encontrado.");
          setCarregando(false);
          return;
        }

        // 🔍 Buscar rodadas no formato novo
        const novaRef = collection(db, "rodadas", codigoTurma, "rodada1");
        const novaSnap = await getDocs(novaRef);
        const novasRodadas = novaSnap.docs
          .map(doc => doc.data() as Rodada)
          .filter(r => r.status === "✅");

        // 🔍 Buscar rodadas no formato antigo
        const antigaRef = collection(db, "rodadas");
        const antigaSnap = await getDocs(antigaRef);
        const antigasRodadas = antigaSnap.docs
          .filter(doc => doc.id.startsWith(`${codigoTurma}_rodada1_`))
          .map(doc => doc.data() as Rodada)
          .filter(r => r.status === "✅");

        // 🔗 Combinar os dois
        const todasRodadas = [...novasRodadas, ...antigasRodadas];
        setRodadas(todasRodadas);

        // 🧠 Mapa de nomes dos times
        const timesSnap = await getDocs(collection(db, "times"));
        const nomes: Record<string, string> = {};
        timesSnap.docs.forEach(doc => {
          const data = doc.data();
          nomes[doc.id] = data.nome || doc.id;
        });

        setMapaDeNomes(nomes);
      } catch (error) {
        console.error("Erro ao buscar rodadas:", error);
        setErro("❌ Não foi possível carregar os dados das rodadas.");
      } finally {
        setCarregando(false);
      }
    };

    fetchRodadas();
  }, []);

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

      <h2>📊 Relatório Global de Rodadas</h2>

      {erro && <p style={{ padding: "2rem", color: "red" }}>{erro}</p>}
      {carregando && <p style={{ padding: "2rem" }}>🔄 Carregando relatório global...</p>}
      {!carregando && rodadas.length === 0 && (
        <p style={{ padding: "2rem" }}>📭 Nenhuma rodada válida encontrada.</p>
      )}

      {!carregando && rodadas.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
          <thead>
            <tr style={{ backgroundColor: "#eee" }}>
              <th>Rodada</th>
              <th>Time</th>
              <th>EA</th>
              <th>Demanda</th>
              <th>Receita</th>
              <th>Custo</th>
              <th>Lucro</th>
              <th>Reinvestimento</th>
              <th>Caixa Final</th>
              <th>Satisfação</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rodadas.map((r, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor:
                    r.caixaFinal !== undefined && r.caixaFinal < 0
                      ? "#ffe6e6"
                      : r.atraso
                      ? "#fff8dc"
                      : "#fff",
                  textAlign: "center",
                }}
              >
                <td>{index + 1}</td>
                <td>{mapaDeNomes[r.timeId] || r.timeId}</td>
                <td>{r.ea ?? "—"}</td>
                <td>{r.demanda ?? "—"}</td>
                <td>{r.receita !== undefined ? `R$ ${r.receita.toFixed(2)}` : "—"}</td>
                <td>{r.custo !== undefined ? `R$ ${r.custo.toFixed(2)}` : "—"}</td>
                <td>
                  {r.lucro !== undefined ? `R$ ${r.lucro.toFixed(2)}` : "—"}
                  {r.atraso && " ⚠️"}
                </td>
                <td>{r.reinvestimento !== undefined ? `R$ ${r.reinvestimento.toFixed(2)}` : "—"}</td>
                <td>{r.caixaFinal !== undefined ? `R$ ${r.caixaFinal.toFixed(2)}` : "—"}</td>
                <td>{r.satisfacao !== undefined ? `${r.satisfacao.toFixed(1)}%` : "—"}</td>
                <td>{r.atraso ? "⚠️ Atraso" : "✅"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

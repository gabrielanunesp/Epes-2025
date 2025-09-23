import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";

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

const Relatorio: React.FC = () => {
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const papel = localStorage.getItem("papel");
  useEffect(() => {
    const fetchRodadas = async () => {
      try {
        let codigoTurma = localStorage.getItem("codigoTurma");

        if (papel === "responsavel" && !codigoTurma) {
          codigoTurma = "turmaExemplo"; // substitua por uma turma real
        }

        if (!codigoTurma) {
          setErro("❌ Código da turma não encontrado.");
          setCarregando(false);
          return;
        }

        const rodadaRef = collection(db, "rodadas", codigoTurma, "rodada1");
        const snapshot = await getDocs(rodadaRef);
        const dados = snapshot.docs
          .map(doc => doc.data() as Rodada)
          .filter(r => r.status === "✅");

        setRodadas(dados);

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
  if (erro) {
    return <p style={{ padding: "2rem", color: "red" }}>{erro}</p>;
  }

  if (carregando) {
    return <p style={{ padding: "2rem" }}>🔄 Carregando relatório de rodadas...</p>;
  }

  if (rodadas.length === 0) {
    return <p style={{ padding: "2rem" }}>📭 Nenhuma rodada válida encontrada.</p>;
  }
  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório de Rodadas</h2>

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
    </div>
  );
};

export default Relatorio;

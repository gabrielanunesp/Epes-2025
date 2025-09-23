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

type TimeResumo = {
  nome: string;
  lucroTotal: number;
  satisfacaoMedia: number;
  caixaFinal: number;
  scoreEPES: number;
};

export default function Informacoes() {
  const [resumoTurmas, setResumoTurmas] = useState<Record<string, Rodada[]>>({});
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<TimeResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);

  const papel = localStorage.getItem("papel");
  const grupoValido =
    papel === "responsavel" || papel === "capitao" ? true : true; // qualquer outro papel é tratado como membro

  useEffect(() => {
    const fetchResumoGlobal = async () => {
      try {
        const nomes: Record<string, string> = {};
        const timesSnap = await getDocs(collection(db, "times"));
        timesSnap.docs.forEach(doc => {
          const data = doc.data();
          nomes[doc.id] = data.nome || doc.id;
        });
        setMapaDeNomes(nomes);

        const resultado: Record<string, Rodada[]> = {};
        const chavesUnicas = new Set<string>();

        const empresasSnap = await getDocs(collection(db, "empresas"));
        const codigosTurma = empresasSnap.docs.map(doc => doc.id);

        const processarRodada = (codigo: string, data: Rodada) => {
          const chave = `${codigo}_${data.timeId}_${data.timestamp?.seconds || ""}`;
          if (!chavesUnicas.has(chave) && (!data.status || data.status === "✅")) {
            chavesUnicas.add(chave);
            if (!resultado[codigo]) resultado[codigo] = [];
            resultado[codigo].push(data);
          }
        };
        for (const codigoTurma of codigosTurma) {
          const rodadaRef = collection(db, "rodadas", codigoTurma, `rodada${rodadaSelecionada}`);
          const rodadaSnap = await getDocs(rodadaRef);
          rodadaSnap.docs.forEach(doc => {
            const data = doc.data() as Rodada;
            processarRodada(codigoTurma, data);
          });
        }

        const rodadasFlatSnap = await getDocs(collection(db, "rodadas"));
        rodadasFlatSnap.docs.forEach(doc => {
          const id = doc.id;
          const match = id.match(new RegExp(`^(\\d{6})_rodada${rodadaSelecionada}_`));
          if (match) {
            const codigo = match[1];
            const data = doc.data() as Rodada;
            processarRodada(codigo, data);
          }
        });

        const decisoesSnap = await getDocs(collection(db, "decisoes"));
        decisoesSnap.docs.forEach(doc => {
          const id = doc.id;
          const match = id.match(new RegExp(`^(\\d{6})_rodada${rodadaSelecionada}_`));
          if (match) {
            const codigo = match[1];
            const data = doc.data() as Rodada;
            processarRodada(codigo, data);
          }
        });

        setResumoTurmas(resultado);

        const timesResumo: Record<string, TimeResumo> = {};

        Object.values(resultado).flat().forEach(r => {
          const nome = nomes[r.timeId] || r.timeId;
          if (!timesResumo[r.timeId]) {
            timesResumo[r.timeId] = {
              nome,
              lucroTotal: 0,
              satisfacaoMedia: 0,
              caixaFinal: r.caixaFinal ?? 0,
              scoreEPES: 0,
            };
          }

          timesResumo[r.timeId].lucroTotal += r.lucro ?? 0;
          timesResumo[r.timeId].satisfacaoMedia += r.satisfacao ?? 0;
        });

        const rankingFinal = Object.values(timesResumo).map(t => {
          const score =
            t.caixaFinal * 0.4 +
            t.lucroTotal * 0.3 +
            t.satisfacaoMedia * 0.3;
          return { ...t, scoreEPES: score };
        });

        rankingFinal.sort((a, b) => b.scoreEPES - a.scoreEPES);
        setRanking(rankingFinal);
      } catch (error) {
        console.error("Erro ao buscar decisões:", error);
        setErro("❌ Não foi possível carregar os dados.");
      } finally {
        setCarregando(false);
      }
    };

    fetchResumoGlobal();
  }, [rodadaSelecionada]);
       return (
    <div className="page-container">
      <h2>📊 Relatório Global de Todas as Turmas</h2>

      <div style={{ marginBottom: "2rem" }}>
        <label htmlFor="rodadaSelect"><strong>Selecionar rodada:</strong></label>{" "}
        <select
          id="rodadaSelect"
          value={rodadaSelecionada}
          onChange={e => setRodadaSelecionada(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map(num => (
            <option key={num} value={num}>
              Rodada {num}
            </option>
          ))}
        </select>
      </div>

      {erro && <p style={{ padding: "2rem", color: "red" }}>{erro}</p>}
      {carregando && <p style={{ padding: "2rem" }}>🔄 Carregando dados...</p>}

      {!carregando && ranking.length > 0 && (
        <>
          <h3>🏆 Ranking Geral dos Times — Rodada {rodadaSelecionada}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr style={{ backgroundColor: "#eee" }}>
                <th>#</th>
                <th>Time</th>
                <th>Score EPES</th>
                <th>Lucro Total</th>
                <th>Satisfação</th>
                <th>Caixa Final</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((t, index) => (
                <tr key={index} style={{ textAlign: "center" }}>
                  <td>{index + 1}</td>
                  <td>{t.nome}</td>
                  <td>{t.scoreEPES.toFixed(2)}</td>
                  <td>R$ {t.lucroTotal.toFixed(2)}</td>
                  <td>{t.satisfacaoMedia.toFixed(1)}%</td>
                  <td>R$ {t.caixaFinal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!carregando &&
        Object.entries(resumoTurmas).map(([turma, rodadas]) => (
          <div key={turma} style={{ marginBottom: "3rem" }}>
            <h3>📘 Turma: {turma}</h3>
            {rodadas.length === 0 ? (
              <p>📭 Nenhuma decisão registrada.</p>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
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
                        <td>{r.receita != null ? `R$ ${r.receita.toFixed(2)}` : "—"}</td>
                        <td>{r.custo != null ? `R$ ${r.custo.toFixed(2)}` : "—"}</td>
                        <td>
                          {r.lucro != null ? `R$ ${r.lucro.toFixed(2)}` : "—"}
                          {r.atraso && " ⚠️"}
                        </td>
                        <td>{r.reinvestimento != null ? `R$ ${r.reinvestimento.toFixed(2)}` : "—"}</td>
                        <td>{r.caixaFinal != null ? `R$ ${r.caixaFinal.toFixed(2)}` : "—"}</td>
                        <td>{r.satisfacao != null ? `${r.satisfacao.toFixed(1)}%` : "—"}</td>
                        <td>{r.atraso ? "⚠️ Atraso" : "✅"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <hr
                  style={{
                    margin: "2rem 0",
                    border: "none",
                    borderTop: "2px dashed #ccc",
                  }}
                />
              </>
            )}
          </div>
        ))}
    </div>
  );
}

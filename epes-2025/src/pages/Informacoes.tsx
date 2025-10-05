import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
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
  const [rankingFinalGlobal, setRankingFinalGlobal] = useState<TimeResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [rodadaMaxima, setRodadaMaxima] = useState(10);

  // Carrega parâmetros gerais (rodadaFinal etc.)
  useEffect(() => {
    const buscarRodadaAtual = async () => {
      try {
        const geralRef = doc(db, "configuracoes", "geral");
        const geralSnap = await getDoc(geralRef);
        const rodadaFinal = geralSnap.data()?.rodadaFinal ?? 10;
        setRodadaMaxima(rodadaFinal);
      } catch (error) {
        console.error("Erro ao buscar rodada final:", error);
      }
    };
    buscarRodadaAtual();
  }, []);

  // Busca e monta o relatório
  useEffect(() => {
    const fetchResumoGlobal = async () => {
      try {
        setErro(null);
        setCarregando(true);

        // 1) Gate: só libera se a rodada estiver fechada OU o prazo já tiver passado
        const geralRef = doc(db, "configuracoes", "geral");
        const geralSnap = await getDoc(geralRef);
        const geral = geralSnap.data() || {};
        const ativa = geral?.rodadaAtiva === true;
        const prazoMs =
          geral?.prazo?.toMillis ? geral.prazo.toMillis() : null;
        const agora = Date.now();

        if (ativa && prazoMs && agora < prazoMs) {
          setErro(
            "⏳ A rodada está aberta. O relatório libera quando fechar ou quando o prazo expirar."
          );
          setResumoTurmas({});
          setRanking([]);
          setRankingFinalGlobal([]);
          setCarregando(false);
          return;
        }

        // 2) Mapa de nomes (times)
        const nomes: Record<string, string> = {};
        const timesSnap = await getDocs(collection(db, "times"));
        timesSnap.docs.forEach((d) => {
          const data = d.data() as any;
          nomes[d.id] = data?.nome || d.id;
        });
        setMapaDeNomes(nomes);

        // 3) Lista de turmas (empresas). Se não houver, tenta extrair de times.codigoTurma
        const empresasSnap = await getDocs(collection(db, "empresas"));
        let turmas = empresasSnap.docs.map((d) => d.id);
        if (turmas.length === 0) {
          const codigos = new Set<string>();
          timesSnap.docs.forEach((d) => {
            const ct = (d.data() as any)?.codigoTurma;
            if (ct) codigos.add(ct);
          });
          turmas = Array.from(codigos);
        }

        // 4) Ler documentos da coleção da rodada (sua estrutura atual)
        //    Caminho: rodadas/{turma}/rodada{N}  ← "rodada{N}" é COLEÇÃO
        const resultadoPorTurma: Record<string, Rodada[]> = {};
        for (const codigoTurma of turmas) {
          const colecao = collection(
            db,
            "rodadas",
            codigoTurma,
            `rodada${rodadaSelecionada}`
          );
          const snap = await getDocs(colecao);
          const arr: Rodada[] = [];
          snap.docs.forEach((dDoc) => {
            const data = dDoc.data() as Rodada;
            // opcional: filtrar apenas oficiais, se você marcar algo no fechamento
            // if (data.status === "✅") { arr.push(data); }
            arr.push(data);
          });
          resultadoPorTurma[codigoTurma] = arr;
        }
        setResumoTurmas(resultadoPorTurma);

        // 5) Ranking da rodada atual (agrega por time across turmas)
        const timesResumo: Record<string, TimeResumo> = {};
        Object.values(resultadoPorTurma)
          .flat()
          .forEach((r) => {
            if (!r?.timeId) return;
            const nome = nomes[r.timeId] || r.timeId;
            if (!timesResumo[r.timeId]) {
              timesResumo[r.timeId] = {
                nome,
                lucroTotal: 0,
                satisfacaoMedia: 0,
                caixaFinal: 0,
                scoreEPES: 0,
              };
            }
            timesResumo[r.timeId].lucroTotal += r.lucro ?? 0;
            timesResumo[r.timeId].satisfacaoMedia += r.satisfacao ?? 0;
            if (typeof r.caixaFinal === "number") {
              timesResumo[r.timeId].caixaFinal = r.caixaFinal;
            }
          });

        const rankingRodada = Object.values(timesResumo)
          .map((t) => {
            const score =
              t.caixaFinal * 0.4 + t.lucroTotal * 0.3 + t.satisfacaoMedia * 0.3;
            return { ...t, scoreEPES: score };
          })
          .sort((a, b) => b.scoreEPES - a.scoreEPES);
        setRanking(rankingRodada);

        // 6) Ranking global (todas as rodadas/turmas) usando a MESMA estrutura atual
        const aggGlobal: Record<
          string,
          {
            nome: string;
            lucroTotal: number;
            satisfacaoSoma: number;
            rodadas: number;
            caixaFinal: number;
            scoreEPES: number;
          }
        > = {};

        for (const codigoTurma of turmas) {
          for (let r = 1; r <= rodadaMaxima; r++) {
            const colecao = collection(db, "rodadas", codigoTurma, `rodada${r}`);
            const resSnap = await getDocs(colecao);
            resSnap.docs.forEach((dDoc) => {
              const data = dDoc.data() as Rodada;
              if (!data?.timeId) return;
              const nome = nomes[data.timeId] || data.timeId;
              if (!aggGlobal[data.timeId]) {
                aggGlobal[data.timeId] = {
                  nome,
                  lucroTotal: 0,
                  satisfacaoSoma: 0,
                  rodadas: 0,
                  caixaFinal: 0,
                  scoreEPES: 0,
                };
              }
              aggGlobal[data.timeId].lucroTotal += data.lucro ?? 0;
              aggGlobal[data.timeId].satisfacaoSoma += data.satisfacao ?? 0;
              aggGlobal[data.timeId].rodadas += 1;
              if (typeof data.caixaFinal === "number") {
                aggGlobal[data.timeId].caixaFinal = data.caixaFinal;
              }
            });
          }
        }

        const rankFinal = Object.values(aggGlobal)
          .map((t) => {
            const satisfacaoMedia =
              t.rodadas > 0 ? t.satisfacaoSoma / t.rodadas : 0;
            const score =
              t.caixaFinal * 0.4 +
              t.lucroTotal * 0.3 +
              satisfacaoMedia * 0.3;
            return {
              nome: t.nome,
              lucroTotal: t.lucroTotal,
              satisfacaoMedia,
              caixaFinal: t.caixaFinal,
              scoreEPES: score,
            };
          })
          .sort((a, b) => b.scoreEPES - a.scoreEPES);
        setRankingFinalGlobal(rankFinal);
      } catch (e: any) {
        console.error("Erro ao buscar resultados oficiais:", e);
        const msg = e?.message || e?.code || JSON.stringify(e);
        setErro(`❌ Não foi possível carregar os dados: ${msg}`);
        setResumoTurmas({});
        setRanking([]);
        setRankingFinalGlobal([]);
      } finally {
        setCarregando(false);
      }
    };

    fetchResumoGlobal();
  }, [rodadaSelecionada, rodadaMaxima]);

  return (
    <div className="page-container">
      <h2>📊 Relatório Global de Todas as Turmas</h2>

      <div style={{ marginBottom: "2rem" }}>
        <label htmlFor="rodadaSelect"><strong>Selecionar rodada:</strong></label>{" "}
        <select
          id="rodadaSelect"
          value={rodadaSelecionada}
          onChange={(e) => setRodadaSelecionada(Number(e.target.value))}
        >
          {Array.from({ length: rodadaMaxima }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              Rodada {num}
            </option>
          ))}
        </select>
      </div>

      {erro && <p style={{ padding: "2rem", color: "red" }}>{erro}</p>}
      {carregando && <p style={{ padding: "2rem" }}>🔄 Carregando dados...</p>}

      {!carregando && !erro && ranking.length > 0 && (
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

      {!carregando && !erro && rodadaSelecionada === rodadaMaxima && rankingFinalGlobal.length > 0 && (
        <>
          <h3>🏁 Ranking Final — Vencedores após todas as rodadas</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr style={{ backgroundColor: "#eee" }}>
                <th>🏆 Posição</th>
                <th>Time</th>
                <th>Score EPES</th>
                <th>Lucro Total</th>
                <th>Satisfação Média</th>
                <th>Caixa Final</th>
              </tr>
            </thead>
            <tbody>
              {rankingFinalGlobal.map((t, index) => (
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
        !erro &&
        Object.entries(resumoTurmas).map(([turma, rodadas]) => (
          <div key={turma} style={{ marginBottom: "3rem" }}>
            <h3>📘 Turma: {turma}</h3>
            {rodadas.length === 0 ? (
              <p>📭 Nenhum resultado registrado nesta rodada.</p>
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
                        <td>{rodadaSelecionada}</td>
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
                        <td>{r.atraso ? "⚠️ Atraso" : (r.status || "✅")}</td>
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

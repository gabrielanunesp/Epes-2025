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
  publicoAlvo?: string;
  lucroTotal: number;
  satisfacaoMedia: number;
  caixaFinal: number;
  scoreEPES: number;
};

export default function Informacoes() {
  const [resumoTurmas, setResumoTurmas] = useState<Record<string, Rodada[]>>({});
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [mapaPublico, setMapaPublico] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<TimeResumo[]>([]);
  const [rankingFinalGlobal, setRankingFinalGlobal] = useState<TimeResumo[]>([]); // mantém para compatibilidade, sem uso aqui
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [rodadaMaxima, setRodadaMaxima] = useState(10);

  useEffect(() => {
    const buscarRodadaAtual = async () => {
      try {
        const geralRef = doc(db, "configuracoes", "geral");
        const geralSnap = await getDoc(geralRef);
        const rodadaFinal = geralSnap.data()?.rodadaFinal ?? 10;
        setRodadaMaxima(rodadaFinal);
      } catch (error) {
        console.error("Erro ao buscar rodada atual:", error);
      }
    };
    buscarRodadaAtual();
  }, []);

  useEffect(() => {
    const fetchResumoGlobal = async () => {
      try {
        setErro(null);
        setCarregando(true);

        // 1) Carrega times (nomes + ids)
        const nomes: Record<string, string> = {};
        const timesSnap = await getDocs(collection(db, "times"));
        const teamIds = timesSnap.docs.map((d) => {
          const data = d.data() as any;
          nomes[d.id] = data.nome || d.id;
          return d.id as string;
        });
        setMapaDeNomes(nomes);

        // 2) Carrega público-alvo por time (empresas/{timeId})
        const paEntries = await Promise.all(
          teamIds.map(async (tid) => {
            try {
              const empSnap = await getDoc(doc(db, "empresas", tid));
              return [tid, (empSnap.exists() ? (empSnap.data() as any)?.publicoAlvo : "—") || "—"] as const;
            } catch {
              return [tid, "—"] as const;
            }
          })
        );
        const mapaPA = Object.fromEntries(paEntries) as Record<string, string>;
        setMapaPublico(mapaPA);

        // 3) Lê RESULTADOS OFICIAIS por time para a rodada selecionada
        // resultadosOficiais/{timeId}/rodada{N}/oficial
        const resultado: Record<string, Rodada[]> = {};
        let totalOficiais = 0;

        for (const tid of teamIds) {
          try {
            const oficialRef = doc(
              db,
              "resultadosOficiais",
              tid,
              `rodada${rodadaSelecionada}`,
              "oficial"
            );
            const oficialSnap = await getDoc(oficialRef);
            if (oficialSnap.exists()) {
              const data = oficialSnap.data() as Partial<Rodada>;

              // 🔐 timeId garantido por último (não sobrescreve)
              const packed: Rodada = {
                ...(data as Partial<Rodada>),
                timeId: String(tid),
              } as Rodada;

              if (!resultado[tid]) resultado[tid] = [];
              resultado[tid].push(packed);
              totalOficiais++;
            }
          } catch (e) {
            console.warn(`Sem oficial para time ${tid} na rodada ${rodadaSelecionada}`, e);
          }
        }

        setResumoTurmas(resultado);

        // 4) Ranking da rodada (um oficial por time/rodada)
        const timesResumo: Record<string, TimeResumo> = {};
        Object.entries(resultado).forEach(([tid, arr]) => {
          arr.forEach((r) => {
            const nome = nomes[tid] || tid;
            if (!timesResumo[tid]) {
              timesResumo[tid] = {
                nome,
                publicoAlvo: mapaPA[tid] || "—",
                lucroTotal: 0,
                satisfacaoMedia: 0,
                caixaFinal: r.caixaFinal ?? 0,
                scoreEPES: 0,
              };
            }
            timesResumo[tid].lucroTotal += r.lucro ?? 0;
            timesResumo[tid].satisfacaoMedia += r.satisfacao ?? 0;
          });
        });

        const rankingRodada = Object.values(timesResumo).map((t) => {
          const score =
            (t.caixaFinal ?? 0) * 0.4 +
            (t.lucroTotal ?? 0) * 0.3 +
            (t.satisfacaoMedia ?? 0) * 0.3;
          return { ...t, scoreEPES: score };
        });

        rankingRodada.sort((a, b) => b.scoreEPES - a.scoreEPES);
        setRanking(rankingRodada);

        if (totalOficiais === 0) {
          console.info("Nenhum resultado oficial encontrado nesta rodada.");
        }
      } catch (error) {
        console.error("Erro ao buscar decisões:", error);
        setErro("❌ Não foi possível carregar os dados.");
      } finally {
        setCarregando(false);
      }
    };

    fetchResumoGlobal();
  }, [rodadaSelecionada]);

  const formatBRL = (n?: number) =>
    n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatPct = (n?: number) =>
    n == null ? "—" : `${n.toFixed(1)}%`;
  const formatInt = (n?: number) =>
    n == null ? "—" : Math.round(n).toLocaleString("pt-BR");

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

      {!carregando && ranking.length > 0 && (
        <>
          <h3>🏆 Ranking Geral dos Times — Rodada {rodadaSelecionada}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr style={{ backgroundColor: "#eee" }}>
                <th>#</th>
                <th>Time</th>
                <th>Público-alvo</th>
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
                  <td>{t.publicoAlvo || "—"}</td>
                  <td>{t.scoreEPES.toFixed(2)}</td>
                  <td>{formatBRL(t.lucroTotal)}</td>
                  <td>{formatPct(t.satisfacaoMedia)}</td>
                  <td>{formatBRL(t.caixaFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!carregando &&
        Object.entries(resumoTurmas).map(([tid, rodadas]) => (
          <div key={tid} style={{ marginBottom: "3rem" }}>
            <h3>📘 Time: {mapaDeNomes[tid] || tid}</h3>
            {rodadas.length === 0 ? (
              <p>📭 Nenhum resultado oficial registrado nesta rodada.</p>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#eee" }}>
                      <th>Rodada</th>
                      <th>Time</th>
                      <th>Público-alvo</th>
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
                        <td>{mapaPublico[r.timeId] || "—"}</td>
                        <td>{r.ea ?? "—"}</td>
                        <td>{formatInt(r.demanda)}</td>
                        <td>{formatBRL(r.receita)}</td>
                        <td>{formatBRL(r.custo)}</td>
                        <td>
                          {formatBRL(r.lucro)}
                          {r.atraso && " ⚠️"}
                        </td>
                        <td>{formatBRL(r.reinvestimento)}</td>
                        <td>{formatBRL(r.caixaFinal)}</td>
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

import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import "./Informacoes.css";

// Helper: formata números no padrão brasileiro (R$ 1.234,56)
const formatBRL = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    // fallback simples
    return `R$ ${n.toFixed(2).replace(".", ",")}`;
  }
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0e2a47 0%, #0a1e31 45%, #121212 100%)",
    color: "#eaf2f8",
  } as React.CSSProperties,
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px 24px 56px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 0 24px",
  } as React.CSSProperties,
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  } as React.CSSProperties,
  titleBadge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    letterSpacing: 0.4,
    color: "#9fd3ff",
    background: "rgba(159, 211, 255, 0.12)",
    border: "1px solid rgba(159,211,255,0.25)",
  } as React.CSSProperties,
  h1: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 0.2,
  } as React.CSSProperties,
  glassCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    backdropFilter: "blur(7px)",
    WebkitBackdropFilter: "blur(7px)",
    borderRadius: 16,
  } as React.CSSProperties,
  identity: {
    display: "grid",
    gridTemplateColumns: "72px 1fr auto",
    gap: 16,
    padding: 16,
    alignItems: "center",
  } as React.CSSProperties,
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    border: "2px solid rgba(255,255,255,0.18)",
  } as React.CSSProperties,
  quickRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  } as React.CSSProperties,
  pillBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#eaf2f8",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 24,
  } as React.CSSProperties,
  callout: {
    padding: 18,
    lineHeight: 1.65,
  } as React.CSSProperties,
  calloutTitle: { margin: 0, fontSize: 18, fontWeight: 700 } as React.CSSProperties,
  calloutP: { margin: "8px 0 0", color: "#cbe3ff" } as React.CSSProperties,
  formBox: { padding: 16, marginTop: 16 } as React.CSSProperties,
  formLabel: { display: "block", fontSize: 13, marginTop: 10, marginBottom: 6, opacity: 0.9 } as React.CSSProperties,
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 90,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#eaf2f8",
    padding: "10px 12px",
    borderRadius: 10,
  } as React.CSSProperties,
  colorRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 10 } as React.CSSProperties,
  colorSwatch: { width: 34, height: 34, borderRadius: 8, border: "2px solid rgba(255,255,255,0.2)" } as React.CSSProperties,
  sectionTitle: { margin: "22px 0 8px", fontSize: 18, fontWeight: 800 } as React.CSSProperties,
  footerHint: { opacity: 0.8, fontSize: 12, marginTop: 24 } as React.CSSProperties,
};

// ===== Types =====
type Rodada = {
  timeId: string;
  publicoAlvo?: string;
  preco?: number;
  capacidade?: number;
  ea?: number;
  demanda?: number;
  vendas?: number;
  receita?: number;
  custo?: number;
  lucro?: number;
  lucroAcumulado?: number;
  reinvestimento?: number;
  caixaFinal?: number;
  atraso?: boolean;
  status?: string;
  timestamp?: any;
};

type TimeResumo = {
  timeId: string;
  nome: string;
  lucroRodada: number;
  lucroAcumulado: number;
  caixaFinal: number;
  timestamp?: number;
};

// ===== Component =====
export default function Informacoes() {
  const [resumoTurmas, setResumoTurmas] = useState<Record<string, Rodada[]>>({});
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [publicoMap, setPublicoMap] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<TimeResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [rodadaMaxima, setRodadaMaxima] = useState(10);

  // Carrega limites de rodada
  useEffect(() => {
    const buscarRodadaConfig = async () => {
      try {
        const geralRef = doc(db, "configuracoes", "geral");
        const geralSnap = await getDoc(geralRef);
        const rodadaFinal = geralSnap.data()?.rodadaFinal ?? 10;
        setRodadaMaxima(rodadaFinal);
      } catch (error) {
        console.error("Erro ao buscar rodada atual:", error);
      }
    };
    buscarRodadaConfig();
  }, []);

  // Carrega resumo por rodada
  useEffect(() => {
    const fetchResumoGlobal = async () => {
      try {
        setCarregando(true);
        setErro(null);

        // nomes dos times
        const nomes: Record<string, string> = {};
        const timesSnap = await getDocs(collection(db, "times"));
        timesSnap.docs.forEach((docu) => {
          const data = docu.data();
          nomes[docu.id] = (data as any).nome || docu.id;
        });
        setMapaDeNomes(nomes);

        // público-alvo por time (de 'empresas/{timeId}')
        const empresasSnap = await getDocs(collection(db, "empresas"));
        const pub: Record<string, string> = {};
        empresasSnap.docs.forEach((d) => {
          const e = d.data() as any;
          pub[d.id] = e.publicoAlvo || "";
        });
        setPublicoMap(pub);

        const resultado: Record<string, Rodada[]> = {};
        const chavesUnicas = new Set<string>();

        // lista de turmas (na sua modelagem times também é turmaId)
        const codigosTurma = timesSnap.docs.map((d) => d.id);

        // coleta por turma (usando resultadosOficiais)
        for (const codigoTurma of codigosTurma) {
          const rodadaRef = collection(
            db,
            "resultadosOficiais",
            codigoTurma,
            `rodada_${rodadaSelecionada}`
          );
          const rodadaSnap = await getDocs(rodadaRef);

          rodadaSnap.forEach((oficialSnap) => {
            const data = oficialSnap.data() as Rodada;
            const chave = `${codigoTurma}_${data.timeId || oficialSnap.id}_${data.timestamp?.seconds || ""}`;
            if (!chavesUnicas.has(chave)) {
              chavesUnicas.add(chave);
              if (!resultado[codigoTurma]) resultado[codigoTurma] = [];
              const timeId = data.timeId || oficialSnap.id;
              const publicoAlvo = data.publicoAlvo || pub[timeId] || "";
              const vendas =
                typeof data.vendas === "number"
                  ? data.vendas
                  : typeof data.demanda === "number"
                  ? data.demanda
                  : 0;
              resultado[codigoTurma].push({ ...data, publicoAlvo, vendas });
            }
          });
        }

        setResumoTurmas(resultado);

        // ranking da rodada (ordenado por lucro acumulado)
        const timesResumo: Record<string, TimeResumo> = {};
        Object.values(resultado)
          .flat()
          .forEach((r) => {
            const nome = nomes[r.timeId] || r.timeId;
            const lucroRodada = Number(r.lucro ?? 0);
            const lucroAcumulado = Number(r.lucroAcumulado ?? r.lucro ?? 0);
            const ts = r.timestamp?.seconds ? Number(r.timestamp.seconds) : 0;

            // mantém o registro mais recente por time, caso haja duplicatas
            const existing = timesResumo[r.timeId];
            if (!existing || (ts && (existing.timestamp || 0) < ts)) {
              timesResumo[r.timeId] = {
                timeId: r.timeId,
                nome,
                lucroRodada,
                lucroAcumulado,
                caixaFinal: Number(r.caixaFinal ?? 0),
                timestamp: ts,
              };
            }
          });

        const rankingRodada = Object.values(timesResumo).sort((a, b) => {
          // 1) lucro acumulado desc
          if (b.lucroAcumulado !== a.lucroAcumulado) return b.lucroAcumulado - a.lucroAcumulado;
          // 2) lucro da rodada desc
          if (b.lucroRodada !== a.lucroRodada) return b.lucroRodada - a.lucroRodada;
          // 3) caixa final desc
          return (b.caixaFinal ?? 0) - (a.caixaFinal ?? 0);
        });

        setRanking(rankingRodada);
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
    <div className="info-page">
        <div className="info-container">
              {/* Header */}
              <header className="info-header">
               <div style={styles.titleWrap}>
                    <span style={styles.titleBadge}>EPES • Challenge 2025</span>
                    <h1 style={styles.h1}>Relatório Global da Competição</h1>
                </div>
                <div className="info-header__controls">
                  <label className="info-select__label" htmlFor="rodadaSelect">Selecionar rodada</label>
                  <select
                    id="rodadaSelect"
                    className="info-select"
                    value={rodadaSelecionada}
                    onChange={(e) => setRodadaSelecionada(Number(e.target.value))}
                  >
                    {Array.from({ length: rodadaMaxima }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>Rodada {num}</option>
                    ))}
                  </select>
                </div>
              </header>

              {erro && <div className="info-alert info-alert--error">{erro}</div>}

              {carregando && (
                <div className="info-skeleton">
                  <div className="info-skeleton__bar" />
                  <div className="info-skeleton__bar" />
                  <div className="info-skeleton__bar" />
                </div>
              )}

              {!carregando && ranking.length > 0 && (
                <section className="card--glass">
                  <div className="card__header">
                    <h3>🏆 Ranking da Rodada {rodadaSelecionada}</h3>
                  </div>
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Time</th>
                          <th>Público-alvo</th>
                          <th>Lucro <br />(rodada)</th>
                          <th>Lucro <br />acumulado</th>
                          <th>Recurso Adicional<br />para Investimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.map((t, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{t.nome}</td>
                            <td>
                              {
                                publicoMap[
                                  Object.keys(mapaDeNomes).find((k) => mapaDeNomes[k] === t.nome) || t.timeId || ""
                                ] || "—"
                              }
                            </td>
                                <td>{formatBRL(t.lucroRodada)}</td>
                                <td>{formatBRL(t.lucroAcumulado)}</td>
                                <td>{formatBRL(Math.max(0, Number((t.lucroAcumulado || 0) * 0.20)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!carregando &&
                Object.entries(resumoTurmas).map(([turma, rodadas]) => (
                  <section key={turma} className="card--glass">
                    <div className="card__header">
                      <h3>📘 Time: {mapaDeNomes[turma] || turma}</h3>
                    </div>

                    {rodadas.length === 0 ? (
                      <p className="info-empty">📭 Nenhum resultado registrado nesta rodada.</p>
                    ) : (
                      <div className="table-wrapper">
                        <table className="table" style={{ fontSize: "13px" }}>
                          <thead>
                            <tr>
                              <th>Rodada</th>
                              <th>Time</th>
                              <th>Público-alvo</th>
                              <th>EA</th>
                              <th>Vendas</th>
                              <th>Receita</th>
                              <th>Custo</th>
                              <th>Lucro</th>
                              <th>Lucro acumulado</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rodadas.map((r, index) => (
                              <tr
                                key={index}
                                className={
                                  r.caixaFinal !== undefined && r.caixaFinal < 0
                                    ? "row--danger"
                                    : r.atraso
                                    ? "row--warn"
                                    : undefined
                                }
                              >
                                <td>{rodadaSelecionada}</td>
                                <td>{mapaDeNomes[r.timeId] || r.timeId}</td>
                                <td>{publicoMap[r.timeId] || "—"}</td>
                                <td>{r.ea ?? "—"}</td>
                                <td>{(r.vendas ?? r.demanda ?? 0).toLocaleString("pt-BR")}</td>
                                <td>{r.receita != null ? formatBRL(r.receita) : "—"}</td>
                                <td>{r.custo != null ? formatBRL(r.custo) : "—"}</td>
                                <td>{r.lucro != null ? formatBRL(r.lucro) : "—"}</td>
                                <td>{r.lucroAcumulado != null ? formatBRL(r.lucroAcumulado) : "—"}</td>
                                <td>{r.atraso ? "⚠️ Atraso" : r.status || "✅"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
            </div>
        </div>
  );
}
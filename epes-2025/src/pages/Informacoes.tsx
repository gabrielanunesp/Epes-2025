import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import "./Informacoes.css";

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
  reinvestimento?: number;
  caixaFinal?: number;
  atraso?: boolean;
  status?: string;
  timestamp?: any;
};

type TimeResumo = {
  nome: string;
  lucroTotal: number;
  caixaFinal: number;
};

export default function Informacoes() {
  const [resumoTurmas, setResumoTurmas] = useState<Record<string, Rodada[]>>({});
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [publicoMap, setPublicoMap] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<TimeResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rodadaSelecionada, setRodadaSelecionada] = useState(1);
  const [rodadaMaxima, setRodadaMaxima] = useState(10);
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

  useEffect(() => {
    const fetchResumoGlobal = async () => {
      try {
        setCarregando(true);

        // nomes dos times
        const nomes: Record<string, string> = {};
        const timesSnap = await getDocs(collection(db, "times"));
        timesSnap.docs.forEach(docu => {
          const data = docu.data();
          nomes[docu.id] = (data as any).nome || docu.id;
        });
        setMapaDeNomes(nomes);

        // público-alvo por time (de 'empresas/{timeId}')
        const empresasSnap = await getDocs(collection(db, "empresas"));
        const pub: Record<string, string> = {};
        empresasSnap.docs.forEach(d => {
          const e = d.data() as any;
          pub[d.id] = e.publicoAlvo || "";
        });
        setPublicoMap(pub);

        const resultado: Record<string, Rodada[]> = {};
        const chavesUnicas = new Set<string>();

        // lista de turmas (na sua modelagem times também é turmaId)
        const codigosTurma = timesSnap.docs.map(d => d.id);
        // coleta por turma (agora usando resultadosOficiais)
        for (const codigoTurma of codigosTurma) {
          const oficialRef = doc(
            db,
            "resultadosOficiais",
            codigoTurma,
            `rodada${rodadaSelecionada}`,
            "oficial"
          );
          const oficialSnap = await getDoc(oficialRef);

          if (oficialSnap.exists()) {
            const data = oficialSnap.data() as Rodada;
            const chave = `${codigoTurma}_${data.timeId}_${data.timestamp?.seconds || ""}`;
            if (!chavesUnicas.has(chave)) {
              chavesUnicas.add(chave);
              if (!resultado[codigoTurma]) resultado[codigoTurma] = [];
              const timeId = data.timeId;
              const publicoAlvo = data.publicoAlvo || pub[timeId] || "";
              const vendas =
                typeof data.vendas === "number"
                  ? data.vendas
                  : typeof data.demanda === "number"
                  ? data.demanda
                  : 0;
              resultado[codigoTurma].push({ ...data, publicoAlvo, vendas });
            }
          }
        }

        setResumoTurmas(resultado);
        // ranking simples da rodada (sem exibir score/satisfação)
        const timesResumo: Record<string, TimeResumo> = {};
        Object.values(resultado).flat().forEach(r => {
          const nome = nomes[r.timeId] || r.timeId;
          if (!timesResumo[r.timeId]) {
            timesResumo[r.timeId] = {
              nome,
              lucroTotal: 0,
              caixaFinal: r.caixaFinal ?? 0,
            };
          }
          timesResumo[r.timeId].lucroTotal += r.lucro ?? 0;
        });

        const rankingRodada = Object.values(timesResumo).sort((a, b) => {
          // ordena por caixaFinal, depois lucroTotal
          if ((b.caixaFinal ?? 0) !== (a.caixaFinal ?? 0)) {
            return (b.caixaFinal ?? 0) - (a.caixaFinal ?? 0);
          }
          return (b.lucroTotal ?? 0) - (a.lucroTotal ?? 0);
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
    <div className="page-container">
      <h2>📊 Relatório Global de Todas as Turmas</h2>

      <div style={{ marginBottom: "2rem" }}>
        <label htmlFor="rodadaSelect"><strong>Selecionar rodada:</strong></label>{" "}
        <select
          id="rodadaSelect"
          value={rodadaSelecionada}
          onChange={e => setRodadaSelecionada(Number(e.target.value))}
        >
          {Array.from({ length: rodadaMaxima }, (_, i) => i + 1).map(num => (
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
          <h3>🏆 Ranking da Rodada {rodadaSelecionada}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
            <thead>
              <tr style={{ backgroundColor: "#eee" }}>
                <th>#</th>
                <th>Time</th>
                <th>Público-alvo</th>
                <th>Lucro Total</th>
                <th>Caixa Final</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((t, index) => (
                <tr key={index} style={{ textAlign: "center" }}>
                  <td>{index + 1}</td>
                  <td>{t.nome}</td>
                  <td>{publicoMap[
                    Object.keys(mapaDeNomes).find(k => mapaDeNomes[k] === t.nome) || ""
                  ] || "—"}</td>
                  <td>R$ {t.lucroTotal.toFixed(2)}</td>
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
            <h3>📘 Time: {mapaDeNomes[turma] || turma}</h3>
            {rodadas.length === 0 ? (
              <p>📭 Nenhum resultado registrado nesta rodada.</p>
            ) : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#eee" }}>
                      <th>Rodada</th>
                      <th>Time</th>
                      <th>Público-alvo</th>
                      <th>EA</th>
                      <th>Vendas</th>
                      <th>Receita</th>
                      <th>Custo</th>
                      <th>Lucro</th>
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
                        <td>{publicoMap[r.timeId] || "—"}</td>
                        <td>{r.ea ?? "—"}</td>
                        <td>{(r.vendas ?? r.demanda ?? 0).toLocaleString("pt-BR")}</td>
                        <td>{r.receita != null ? `R$ ${r.receita.toFixed(2)}` : "—"}</td>
                        <td>{r.custo != null ? `R$ ${r.custo.toFixed(2)}` : "—"}</td>
                        <td>{r.lucro != null ? `R$ ${r.lucro.toFixed(2)}` : "—"}</td>
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

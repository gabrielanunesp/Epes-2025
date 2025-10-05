// src/pages/Relatorio.tsx
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

type Rodada = {
  timeId: string;
  ea?: number;
  demanda?: number;
  receita?: number;
  custo?: number;
  lucro?: number;
  reinvestimento?: number;
  caixaFinal?: number;
  satisfacao?: number;     // 0..100
  atraso?: boolean;
  decisaoForaDoPrazo?: boolean;
  status?: string;         // "✅" quando válido
  timestamp?: any;
};

const fmtBRL = (v: number | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR");
const fmtPct = (v: number | undefined) =>
  v == null ? "—" : `${v.toFixed(1)}%`;

const Relatorio: React.FC = () => {
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [mapaDeNomes, setMapaDeNomes] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // ⬇️ controle de rodada baseado em configuracoes/geral
  const [rodadaAtual, setRodadaAtual] = useState<number>(1);
  const [rodadaAtiva, setRodadaAtiva] = useState<boolean>(false);
  const [rodadaSelecionada, setRodadaSelecionada] = useState<number>(1);

  const papel = localStorage.getItem("papel");
  const codigoTurmaStorage = localStorage.getItem("codigoTurma") || "";

  useEffect(() => {
    const boot = async () => {
      try {
        setCarregando(true);
        setErro(null);

        // 1) Ler controle global (rodadaAtual / rodadaAtiva)
        const geralSnap = await getDoc(doc(db, "configuracoes", "geral"));
        const g = geralSnap.data() || {};
        const rAtual = Number(g.rodadaAtual ?? 1);
        const rAtiva = g.rodadaAtiva === true;
        setRodadaAtual(rAtual);
        setRodadaAtiva(rAtiva);
        // default: mostrar a última rodada FECHADA
        setRodadaSelecionada(rAtiva ? Math.max(rAtual - 1, 1) : rAtual);

        // 2) Carregar nomes de times (para mostrar nome amigável)
        const timesSnap = await getDocs(collection(db, "times"));
        const nomes: Record<string, string> = {};
        timesSnap.docs.forEach(d => {
          const data = d.data() as any;
          nomes[d.id] = data?.nome || d.id;
        });
        setMapaDeNomes(nomes);
      } catch (e: any) {
        console.error(e);
        setErro("❌ Não foi possível ler as configurações gerais.");
      } finally {
        setCarregando(false);
      }
    };
    boot();
  }, []);

  // 🔄 Buscar resultados oficiais da rodada selecionada
  useEffect(() => {
    const fetchRodadas = async () => {
      try {
        setCarregando(true);
        setErro(null);

        let codigoTurma = codigoTurmaStorage;

        // ADM sem turma selecionada? você pode apontar manualmente se quiser.
        if (papel === "responsavel" && !codigoTurma) {
          setErro("⚠️ Defina um time/código no localStorage.codigoTurma para visualizar o relatório desse time.");
          setRodadas([]);
          return;
        }

        if (!codigoTurma) {
          setErro("❌ Código do time (codigoTurma) não encontrado.");
          setRodadas([]);
          return;
        }

        // Se a rodada selecionada estiver ativa, não há resultado oficial ainda
        if (rodadaAtiva && rodadaSelecionada === rodadaAtual) {
          setErro(`⏳ A Rodada ${rodadaSelecionada} ainda está ativa. Feche a rodada para ver o relatório oficial.`);
          setRodadas([]);
          return;
        }

        // 3) Ler resultados oficiais: resultadosOficiais/{timeId}/rodada{N}
        const ref = collection(db, "resultadosOficiais", codigoTurma, `rodada${rodadaSelecionada}`);
        const snapshot = await getDocs(ref);

        const dados = snapshot.docs
          .map(d => d.data() as Rodada)
          .filter(r => r.status === "✅");

        setRodadas(dados);
      } catch (error) {
        console.error("Erro ao buscar resultados oficiais:", error);
        setErro("❌ Não foi possível carregar os resultados oficiais desta rodada.");
      } finally {
        setCarregando(false);
      }
    };

    // só dispara quando já temos rodadaAtual/rodadaAtiva
    if (rodadaSelecionada > 0) {
      fetchRodadas();
    }
  }, [rodadaSelecionada, rodadaAtual, rodadaAtiva, codigoTurmaStorage, papel]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>📊 Relatório Oficial por Rodada (do seu time)</h2>

      {/* seletor de rodada */}
      <div style={{ margin: "12px 0" }}>
        <label htmlFor="rodadaSelect"><strong>Selecionar rodada:</strong>{" "}</label>
        <select
          id="rodadaSelect"
          value={rodadaSelecionada}
          onChange={(e) => setRodadaSelecionada(Number(e.target.value))}
        >
          {Array.from({ length: Math.max(rodadaAtiva ? Math.max(rodadaAtual - 1, 1) : rodadaAtual, 1) }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>Rodada {n}</option>
          ))}
          {/* se quiser permitir olhar rodadas futuras (sem dados), remova o Array.from acima e gere até rodadaAtual */}
        </select>
        <div style={{ marginTop: 6, color: "#555" }}>
          {rodadaAtiva ? (
            <em>⚠️ Rodada #{rodadaAtual} está ativa — selecione 1..#{Math.max(rodadaAtual - 1, 1)} para ver resultados oficiais.</em>
          ) : (
            <em>✅ Rodada #{rodadaAtual} está fechada — resultados até ela estão disponíveis.</em>
          )}
        </div>
      </div>

      {/* estados */}
      {erro && <p style={{ padding: "1rem", color: "red" }}>{erro}</p>}
      {carregando && <p style={{ padding: "1rem" }}>🔄 Carregando resultados...</p>}
      {!carregando && !erro && rodadas.length === 0 && (
        <p style={{ padding: "1rem" }}>📭 Nenhum resultado oficial encontrado para esta rodada.</p>
      )}

      {/* tabela */}
      {!carregando && !erro && rodadas.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
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
            {rodadas.map((r, idx) => (
              <tr
                key={idx}
                style={{
                  backgroundColor:
                    r.caixaFinal !== undefined && r.caixaFinal < 0
                      ? "#ffe6e6"
                      : r.atraso || r.decisaoForaDoPrazo
                      ? "#fff8dc"
                      : "#fff",
                  textAlign: "center",
                }}
              >
                <td>{rodadaSelecionada}</td>
                <td>{mapaDeNomes[r.timeId] || r.timeId}</td>
                <td>{r.ea ?? "—"}</td>
                <td>{fmtNum(r.demanda)}</td>
                <td>{fmtBRL(r.receita)}</td>
                <td>{fmtBRL(r.custo)}</td>
                <td>
                  {fmtBRL(r.lucro)}
                  {(r.atraso || r.decisaoForaDoPrazo) && " ⚠️"}
                </td>
                <td>{fmtBRL(r.reinvestimento)}</td>
                <td>{fmtBRL(r.caixaFinal)}</td>
                <td>{fmtPct(r.satisfacao)}</td>
                <td>{r.atraso || r.decisaoForaDoPrazo ? "⚠️" : (r.status || "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Relatorio;

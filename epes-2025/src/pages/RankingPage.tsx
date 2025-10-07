// src/pages/RankingPage.tsx
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { useRoundPreview } from "../hooks/useRoundPreview";

type TimeDoc = {
  id: string;
  nome?: string;
};

type ResultadoOficial = {
  lucro?: number;            // R$
  satisfacao?: number;       // 0..100
  caixaFinal?: number;       // R$
  atraso?: boolean;          // true se enviou fora do prazo
  decisaoForaDoPrazo?: boolean;
  status?: string;           // "✅" se válido
  timeId: string;
};

type LinhaRanking = {
  id: string;
  nome: string;
  caixaAcumulado: number;    // último caixa final apurado
  lucroTotal: number;        // soma de lucros nas rodadas fechadas
  lucroMedio: number;        // média
  satisfacaoMedia: number;   // média
  complianceScore: number;   // 0..100 (% de rodadas em conformidade)
  rodadasConcluidas: number; // quantas rodadas fechadas contribuíram
  scoreEPES: number;         // 40/30/20/10
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const RankingPage: React.FC = () => {
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [rodadaAtual, setRodadaAtual] = useState<number>(1);
  const [rodadaAtiva, setRodadaAtiva] = useState<boolean>(false);
  const [seasonId, setSeasonId] = useState<string>("");
  const [roundId, setRoundId] = useState<string>("");
  const [teamId] = useState<string>(localStorage.getItem("idDoTime") ?? "");

  const preview = useRoundPreview({ seasonId, roundId, teamId });

  useEffect(() => {
    (async () => {
      try {
        setCarregando(true);
        setMensagem(null);

        // 1) Ler controle global
        const geralSnap = await getDoc(doc(db, "configuracoes", "geral"));
        const g = geralSnap.data() || {};
        const rAtual = Number(g.rodadaAtual ?? 1);
        const rAtiva = g.rodadaAtiva === true;
        setRodadaAtual(rAtual);
        setRodadaAtiva(rAtiva);
        const season = (g.seasonId as string) ?? "default-season";
        setSeasonId(season);
        setRoundId(`D${rAtual}`);

        // 2) Carregar todos os times
        const timesSnap = await getDocs(collection(db, "times"));
        const times: TimeDoc[] = timesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        if (times.length === 0) {
          setRanking([]);
          setMensagem("Nenhum time cadastrado ainda.");
          setCarregando(false);
          return;
        }

        // 3) Definir rodadas oficialmente fechadas
        const ultimaRodadaFechada = rAtiva ? rAtual - 1 : rAtual;
        if (ultimaRodadaFechada <= 0) {
          setRanking([]);
          setMensagem("Nenhuma rodada foi fechada ainda. O ranking oficial aparece após o fechamento.");
          setCarregando(false);
          return;
        }

        // 4) Agregar resultados oficiais: resultadosOficiais/{timeId}/rodada{n}
        const linhas: LinhaRanking[] = [];
        for (const t of times) {
          let totalLucro = 0;
          let totalSatisf = 0;
          let count = 0;
          let compliant = 0;
          let ultimoCaixa = 0;
          let ultimaRodadaComCaixa = 0;

          for (let n = 1; n <= ultimaRodadaFechada; n++) {
            const sub = collection(db, "resultadosOficiais", t.id, `rodada${n}`);
            const subSnap = await getDocs(sub);

            // Pode haver 0 ou 1 doc (ou mais, se você guardar históricos); vamos somar todos status "✅"
            subSnap.forEach((docSnap) => {
              const r = docSnap.data() as ResultadoOficial;
              if (r.status === "✅") {
                const lucro = r.lucro ?? 0;
                const sat = r.satisfacao ?? 0;
                const caixa = r.caixaFinal ?? 0;

                totalLucro += lucro;
                totalSatisf += sat;
                count += 1;

                const ok =
                  caixa >= 0 &&
                  !r.atraso &&
                  !r.decisaoForaDoPrazo;
                if (ok) compliant += 1;

                // usar o caixa final da rodada mais recente encontrada
                if (n >= ultimaRodadaComCaixa) {
                  ultimaRodadaComCaixa = n;
                  ultimoCaixa = caixa;
                }
              }
            });
          }

          const lucroMedio = count > 0 ? totalLucro / count : 0;
          const satisfacaoMedia = count > 0 ? totalSatisf / count : 0;
          const complianceScore = count > 0 ? (compliant / count) * 100 : 0;

          // 5) Score EPES (40% Caixa • 30% Lucro Médio • 20% Satisfação • 10% Compliance)
          const scoreEPES =
            ultimoCaixa * 0.4 +
            lucroMedio * 0.3 +
            satisfacaoMedia * 0.2 +
            complianceScore * 0.1;

          linhas.push({
            id: t.id,
            nome: t.nome || t.id,
            caixaAcumulado: ultimoCaixa,
            lucroTotal: totalLucro,
            lucroMedio,
            satisfacaoMedia,
            complianceScore,
            rodadasConcluidas: count,
            scoreEPES,
          });
        }

        // 6) Ordenação (Score > Caixa > Satisfação)
        linhas.sort((a, b) => {
          const s = b.scoreEPES - a.scoreEPES;
          if (s !== 0) return s;
          const c = b.caixaAcumulado - a.caixaAcumulado;
          if (c !== 0) return c;
          return b.satisfacaoMedia - a.satisfacaoMedia;
        });

        setRanking(linhas);

        if (linhas.every((l) => l.rodadasConcluidas === 0)) {
          setMensagem("Nenhum resultado oficial encontrado. Feche uma rodada para ver o ranking.");
        }
      } catch (err: any) {
        console.error(err);
        setMensagem("Erro ao carregar ranking. Verifique as coleções 'times' e 'resultadosOficiais/*/rodadaN'.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🏆 Ranking EPES</h1>

      <p style={{ marginTop: 4 }}>
        <strong>Critérios:</strong> 40% Caixa (última rodada fechada) • 30% Lucro Médio • 20% Satisfação Média • 10% Compliance
        <br />
        <strong>Desempate:</strong> Caixa &gt; Satisfação
        <br />
        {rodadaAtiva ? (
          <em>⚠️ Rodada #{rodadaAtual} está ativa — o ranking mostra apenas rodadas fechadas (até #{Math.max(rodadaAtual - 1, 0)}).</em>
        ) : (
          <em>✅ Rodada #{rodadaAtual} está fechada — ranking considera 1..#{rodadaAtual}.</em>
        )}
      </p>

      <section style={{ marginBottom: "2rem", background: "#f8fafc", padding: "1.25rem", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h2 style={{ marginTop: 0 }}>📊 Preview competitivo da rodada ativa</h2>
        {preview.loading && <p>Calculando previsão coletiva...</p>}
        {preview.error && <p style={{ color: "#b91c1c" }}>{preview.error}</p>}
        {!preview.loading && preview.ranking.length === 0 && <p>Aguardando decisões para gerar o preview.</p>}
        {!preview.loading && preview.ranking.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ background: "#e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "8px" }}>#</th>
                <th style={{ textAlign: "left", padding: "8px" }}>Time</th>
                <th style={{ textAlign: "right", padding: "8px" }}>Share</th>
                <th style={{ textAlign: "right", padding: "8px" }}>Vendas</th>
                <th style={{ textAlign: "right", padding: "8px" }}>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {preview.ranking.map((linha: any, idx: number) => (
                <tr
                  key={linha.teamId}
                  style={{
                    background: linha.teamId === teamId ? "rgba(34,197,94,0.15)" : "transparent",
                  }}
                >
                  <td style={{ padding: "8px" }}>{idx + 1}</td>
                  <td style={{ padding: "8px" }}>{linha.name ?? linha.teamId}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>{(linha.share * 100).toFixed(2)}%</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>{Math.round(linha.sales).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>R$ {linha.profit.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {carregando && <p>🔄 Carregando...</p>}
      {mensagem && !carregando && <p style={{ color: "#666" }}>{mensagem}</p>}

      {!carregando && ranking.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
          <thead>
            <tr style={{ background: "#eee" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>#</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Time</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Score EPES</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Caixa</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Lucro Total</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Lucro Médio</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Satisfação</th>
              <th style={{ textAlign: "right", padding: "8px" }}>Compliance</th>
              <th style={{ textAlign: "center", padding: "8px" }}>Rodadas</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((t, idx) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "8px" }}>{idx + 1}</td>
                <td style={{ padding: "8px" }}>{t.nome}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{t.scoreEPES.toFixed(2)}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{fmtBRL(t.caixaAcumulado)}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{fmtBRL(t.lucroTotal)}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{fmtBRL(t.lucroMedio)}</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{t.satisfacaoMedia.toFixed(1)}%</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{t.complianceScore.toFixed(1)}%</td>
                <td style={{ padding: "8px", textAlign: "center" }}>{t.rodadasConcluidas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RankingPage;

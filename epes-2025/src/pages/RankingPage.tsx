// src/pages/RankingPage.tsx
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";

type TimeDoc = {
  id: string;
  nome?: string;
  turmaId?: string;
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
  const [turmaIdEfetiva, setTurmaIdEfetiva] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setCarregando(true);
        setMensagem(null);

        // 1) Config global
        const geralSnap = await getDoc(doc(db, "configuracoes", "geral"));
        const g = geralSnap.data() || {};
        const rAtual = Number(g.rodadaAtual ?? 1);
        const rAtiva = g.rodadaAtiva === true;
        setRodadaAtual(rAtual);
        setRodadaAtiva(rAtiva);

        // turma ativa (busca em config; se ausente, deduziremos pelos times)
        const turmaIdConfig: string | undefined = (g.turmaId as string) || (g.codigoTurma as string);

        // 2) Times
        const timesSnap = await getDocs(collection(db, "times"));
        const times: TimeDoc[] = timesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        if (times.length === 0) {
          setRanking([]);
          setMensagem("Nenhum time cadastrado ainda.");
          setCarregando(false);
          return;
        }

        const turmaLocal = String(
          turmaIdConfig ?? times.find((t: any) => t.turmaId)?.turmaId ?? "DEFAULT_TURMA"
        );
        setTurmaIdEfetiva(turmaLocal);

        // 3) Rodadas fechadas
        const ultimaRodadaFechada = rAtiva ? rAtual - 1 : rAtual;
        if (ultimaRodadaFechada <= 0) {
          setRanking([]);
          setMensagem("Nenhuma rodada foi fechada ainda. O ranking oficial aparece após o fechamento.");
          setCarregando(false);
          return;
        }

        // 4) Buscar resultados oficiais (paralelo)
        type Parcial = { lucro: number; satisfacao: number; caixaFinal: number; atraso: boolean; foraPrazo: boolean };
        const linhas: LinhaRanking[] = [];

        await Promise.all(
          times.map(async (t) => {
            let totalLucro = 0;
            let totalSatisf = 0;
            let count = 0;
            let compliant = 0;
            let ultimoCaixa = 0;
            let ultimaRodadaComCaixa = 0;

            const porRodada: Parcial[] = [];
            for (let n = 1; n <= ultimaRodadaFechada; n++) {
              // novo caminho canônico: /resultadosOficiais/{turmaId}/rodada_{n}/{timeId}
              const resRef = doc(db, "resultadosOficiais", turmaLocal, `rodada_${n}`, t.id);
              const resSnap = await getDoc(resRef);
              if (!resSnap.exists()) continue;
              const r = resSnap.data() as ResultadoOficial;
              // se tiver status e não for ✅, ignora
              if (r.status && r.status !== "✅") continue;
              porRodada.push({
                lucro: r.lucro ?? 0,
                satisfacao: r.satisfacao ?? 0,
                caixaFinal: r.caixaFinal ?? 0,
                atraso: !!r.atraso,
                foraPrazo: !!r.decisaoForaDoPrazo,
              });
            }

            porRodada.forEach((r, idx) => {
              totalLucro += r.lucro;
              totalSatisf += r.satisfacao;
              count += 1;

              const ok = r.caixaFinal >= 0 && !r.atraso && !r.foraPrazo;
              if (ok) compliant += 1;

              // caixa mais recente observado
              const rodadaNum = Math.min(ultimaRodadaFechada, idx + 1);
              if (rodadaNum >= ultimaRodadaComCaixa) {
                ultimaRodadaComCaixa = rodadaNum;
                ultimoCaixa = r.caixaFinal;
              }
            });

            const lucroMedio = count > 0 ? totalLucro / count : 0;
            const satisfacaoMedia = count > 0 ? totalSatisf / count : 0;
            const complianceScore = count > 0 ? (compliant / count) * 100 : 0;

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
          })
        );

        // 5) Ordenar e finalizar
        linhas.sort((a, b) => {
          const s = b.scoreEPES - a.scoreEPES;
          if (s !== 0) return s;
          const c = b.caixaAcumulado - a.caixaAcumulado;
          if (c !== 0) return c;
          return b.satisfacaoMedia - a.satisfacaoMedia;
        });

        setRanking(linhas);
        if (linhas.every((l) => l.rodadasConcluidas === 0)) {
          setMensagem(`Nenhum resultado oficial encontrado. Feche ao menos 1 rodada (até #${ultimaRodadaFechada}).`);
        }
      } catch (err: any) {
        console.error(err);
        setMensagem("Erro ao carregar ranking. Verifique 'times' e 'resultadosOficiais/{turmaId}/rodada_{N}/{timeId}'.");
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>🏆 Ranking EPES</h1>
      <p style={{ marginTop: 0, color: "#666" }}>Turma: <strong>{turmaIdEfetiva}</strong></p>

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

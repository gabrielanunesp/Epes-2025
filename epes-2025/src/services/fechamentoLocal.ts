// src/services/fechamentoLocal.ts

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  query,
  where,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/* ============================= Helpers & Consts ============================= */

function calcularCVU(qualidade: number, eficiencia: number): number {
  const base = 20, alpha = 0.2, beta = 0.1;
  const q = Math.max(0, qualidade ?? 0);
  const e = Math.max(0, eficiencia ?? 0);
  return Math.max(0, Number((base + alpha * q - beta * e).toFixed(2)));
}

function beneficioFromBonus(b: number) {
  if (b === 10) return "Cupom";
  if (b === 15) return "Brinde";
  if (b === 20) return "Frete grátis";
  return "Nenhum";
}

function softmax(scores: number[]) {
  if (scores.length === 0) return [];
  const m = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - m));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

function windfallDamping(profits: number[], alpha = 0.2) {
  // amortecedor anti "ganho desproporcional"
  if (profits.length <= 2) return profits;
  const s = [...profits].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  const abs = profits.map((p) => Math.abs(p - med)).sort((a, b) => a - b);
  const mad = abs[Math.floor(abs.length / 2)] || 1;
  const thr = med + 1.5 * mad;
  return profits.map((p) => (p <= thr ? p : thr + (p - thr) * (1 - alpha)));
}

function splitProfit(lucro: number, rate = 0.2) {
  const pos = Math.max(0, lucro);
  return {
    reinvestimento: Number((pos * rate).toFixed(2)),
    caixaDelta: Number((pos * (1 - rate)).toFixed(2)),
  };
}

const qualidadeMult: Record<string, number> = {
  "Jovens (15–24 anos)": 0.8,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.2,
  "Classe A/B": 1.25,
  "Classe C/D": 0.8,
};
const marketingMult: Record<string, number> = {
  "Jovens (15–24 anos)": 1.3,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.2,
  "Classe A/B": 1.1,
  "Classe C/D": 1.15,
};
const equipeMult: Record<string, number> = {
  "Jovens (15–24 anos)": 0.9,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 1.3,
  "Classe A/B": 1.1,
  "Classe C/D": 0.9,
};
const elasticidadePreco: Record<string, number> = {
  "Jovens (15–24 anos)": 1.2,
  "Adultos (25–40 anos)": 1.0,
  "Sêniores (40+)": 0.8,
  "Classe A/B": 0.9,
  "Classe C/D": 1.5,
};
const beneficioBonusExtra: Record<string, number> = {
  "Cupom|Classe C/D": 5,
  "Brinde|Jovens (15–24 anos)": 5,
  "Frete grátis|Adultos (25–40 anos)": 5,
  "Frete grátis|Sêniores (40+)": 5,
};

/* ====================== Mapeadores de níveis → números ====================== */
function mapProdutoToQualidade(nivel: string): number {
  const v = (nivel || "").toLowerCase();
  if (v.includes("premium")) return 50;
  if (v.includes("avanç")) return 35;
  if (v.includes("inter")) return 20;
  return 10; // básico
}
function mapMarketingToBonus(nivel: string): number {
  const v = (nivel || "").toLowerCase();
  if (v.includes("influ")) return 35;
  if (v.includes("nacional")) return 25;
  if (v.includes("regional")) return 15;
  if (v.includes("local")) return 8;
  return 0;
}
function mapEquipeToBonus(nivel: string): number {
  const v = (nivel || "").toLowerCase();
  if (v.includes("especial")) return 40;
  if (v.includes("refor")) return 25;
  if (v.includes("balan")) return 15;
  if (v.includes("enxu")) return 8;
  return 0;
}
function mapBeneficioToBonus(tipo: string): number {
  const v = (tipo || "").toLowerCase();
  if (v.includes("frete")) return 20;
  if (v.includes("brinde")) return 15;
  if (v.includes("cupom")) return 10;
  return 0; // nenhum
}
function mapCapacidadeToValue(raw: string | number): number {
  if (typeof raw === "number") return Math.max(0, raw);
  const s = String(raw || "");
  const m = s.match(/\d+(?:[\.\,]\d+)?/g);
  if (!m) return 0;
  const joined = m.join("").replace(/\D/g, "");
  const n = Number(joined);
  if (!isFinite(n)) return 0;
  // Heurística: valores como "2.000" → 2000
  return n;
}

type Decisao = {
  timeId: string;
  preco: number;
  qualidade: number;
  marketingBonus: number;
  equipeBonus: number;
  beneficioBonus: number;
  capacidade: number;
  publicoAlvo?: string;
  timestamp?: Timestamp;
};

type Resultado = {
  timeId: string;
  ea: number;
  share: number;          // %
  demanda: number;        // vendas (unidades)
  receita: number;
  custo: number;
  lucro: number;
  lucroAcumulado?: number;
  reinvestimento: number;
  caixaFinal: number;     // delta de caixa aplicado (20/80)
  cvu: number;
  backlog: boolean;
  satisfacao: number;
  status: string;
  oficial: true;
  timestamp: Timestamp;
};

/* === Coração da disputa: competição global com elasticidade e mistura === */
function calcularCompeticaoPorPublico(
  decisoes: Decisao[],
  EAs: number[],
  marketSize: number,
  precoMedioMercado: number
) {
  // 1) Ajuste de preço no score antes do softmax (elasticidade por público)
  const scores = decisoes.map((d, i) => {
    const publico = d.publicoAlvo || "Adultos (25–40 anos)";
    const eps = elasticidadePreco[publico] ?? 1.0;
    const preco = Math.max(1, d.preco);
    const priceMult = Math.pow(precoMedioMercado / preco, eps);
    return EAs[i] * priceMult;
  });

  // 2) Softmax global
  let shares = softmax(scores);

  // 3) Mistura uniforme + piso mínimo para evitar winner-takes-all
  const n = Math.max(1, shares.length);
  const lambda = 0.10; // 10% uniforme, 90% mérito
  shares = shares.map((s) => s * (1 - lambda) + (lambda / n));
  const epsShare = 0.02 / n; // 2% distribuído entre todos
  shares = shares.map((s) => Math.max(s, epsShare));
  // Renormaliza
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  shares = shares.map((s) => s / sum);

  // 4) Demanda global respeitando marketSize
  const demandRaw = shares.map((s) => marketSize * s);

  // 5) Capacidade
  let vendasEfetivas = demandRaw.map((d, i) => Math.min(d, Math.max(0, decisoes[i].capacidade)));
  let backlogs = vendasEfetivas.map((v, i) => demandRaw[i] > v);

  // 6) Redistribuição parcial do TRANSBORDO (overflow) proporcional ao EA
  // Calcula apenas o excedente de demanda de quem estourou a capacidade
  const caps = decisoes.map((d) => Math.max(0, d.capacidade || 0));
  const overflow = demandRaw.reduce((acc, d, i) => acc + Math.max(0, d - caps[i]), 0);
  const subRate = 0.5; // % do overflow que migra; ajuste conforme calibragem
  const realocar = overflow * subRate;

  if (realocar > 0.01) {
    // capacidade disponível de quem NÃO bateu no limite
    const flex = decisoes.map((d, i) => Math.max(0, (d.capacidade || 0) - vendasEfetivas[i]));
    const totalFlex = flex.reduce((a, b) => a + b, 0);

    if (totalFlex > 0) {
      // pesos proporcionais ao EA entre os que têm flex
      const pesos = flex.map((f, i) => (f > 0 ? Math.max(1e-6, EAs[i] * f) : 0));
      const somaPesos = pesos.reduce((a, b) => a + b, 0);

      if (somaPesos > 0) {
        const mover = Math.min(realocar, totalFlex);
        for (let i = 0; i < vendasEfetivas.length; i++) {
          if (pesos[i] <= 0) continue;
          const add = (pesos[i] / somaPesos) * mover;
          vendasEfetivas[i] = Math.min(caps[i], vendasEfetivas[i] + add);
        }
      }
    }
  }

  // Recalcula backlog após redistribuição e arredonda vendas
  backlogs = vendasEfetivas.map((v, i) => demandRaw[i] > v);
  vendasEfetivas = vendasEfetivas.map((v) => Math.round(v));

  // DEBUG extra
  console.log("[DEBUG][global] overflow:", overflow, "subRate:", subRate, "realocar:", realocar);
  console.log("[DEBUG][global] EA:", EAs);

  return { vendasEfetivas, backlogs, shares };
}

/* ================================ Função Main ================================ */

export async function fecharRodadaLocal(params?: {
  turma?: string;
  rodada?: number;
}): Promise<{ ok: boolean; turmas: string[]; rodada: number }> {
  console.groupCollapsed("[DEBUG] 🔒 fecharRodadaLocal start");
  console.log("[DEBUG] Params recebidos:", params);
  // 1) configurações gerais
  const geralSnap = await getDoc(doc(db, "configuracoes", "geral"));
  if (!geralSnap.exists()) throw new Error("configuracoes/geral não encontrado.");
  const geral = geralSnap.data() as any;
  console.log("[DEBUG] Doc config/geral:", geral);

  const rodadaAtual = Number(geral.rodadaAtual ?? 1);
  const rodada =
    Number.isFinite(params?.rodada) && (params!.rodada as number) > 0
      ? (params!.rodada as number)
      : rodadaAtual;
  console.log("[DEBUG] Rodada resolvida:", rodada);

  // 2) COLETA GLOBAL DE DECISÕES DA RODADA (todas as turmas competem juntas)
  console.log("[DEBUG][global] Coletando decisões de TODAS as turmas para a rodada", rodada);

  // Buscar duas vezes para tolerar 'rodada' como number e como string
  const qNum = query(collection(db, "decisoes"), where("rodada", "==", rodada));
  const qStr = query(collection(db, "decisoes"), where("rodada", "==", String(rodada)));
  const [snapNum, snapStr] = await Promise.all([getDocs(qNum), getDocs(qStr)]);

  // Consolidar por timeId mantendo a decisão mais recente (timestamp maior)
  type DecisaoExt = Decisao & { turmaId: string };
  const porTimeGlobal = new Map<string, DecisaoExt>();
  const pushDoc = (d: any) => {
    const data = d.data?.() ?? d.data;
    const timeId = data?.timeId;
    const turmaId = String(data?.turmaId || "");
    if (!timeId || !turmaId) return;
    const atual = porTimeGlobal.get(timeId);
    const tsNew = data.timestamp?.seconds ?? 0;
    const tsOld = (atual as any)?.timestamp?.seconds ?? -1;
    if (!atual || tsNew > tsOld) {
      const preco = Number(data.preco ?? 100);
      const qualidade = mapProdutoToQualidade(String(data.produtoNivel ?? data.produto ?? "Básico"));
      const marketingBonus = mapMarketingToBonus(String(data.marketingPacote ?? data.marketing ?? "Local"));
      const equipeBonus = mapEquipeToBonus(String(data.equipeNivel ?? data.equipe ?? "Enxuto"));
      const beneficioBonus = mapBeneficioToBonus(String(data.beneficio ?? "Nenhum"));
      const capacidade = mapCapacidadeToValue(data.capacidadeNivel ?? data.capacidade ?? 0);
      porTimeGlobal.set(timeId, {
        timeId,
        preco,
        qualidade,
        marketingBonus,
        equipeBonus,
        beneficioBonus,
        capacidade,
        publicoAlvo: data.publicoAlvo || undefined,
        timestamp: data.timestamp,
        turmaId,
      });
    }
  };
  snapNum.forEach(pushDoc);
  snapStr.forEach(pushDoc);

  // === Fallback: usar decisões da RODADA ANTERIOR para quem não salvou nesta rodada ===
  const usedPrevByTime = new Map<string, boolean>();
  const rodadaAnterior = Math.max(1, rodada - 1);
  if (porTimeGlobal.size > 0) {
    // Busca decisões da rodada anterior e preenche apenas times AUSENTES nesta rodada
    const qPrevNum = query(collection(db, "decisoes"), where("rodada", "==", rodadaAnterior));
    const qPrevStr = query(collection(db, "decisoes"), where("rodada", "==", String(rodadaAnterior)));
    const [snapPrevNum, snapPrevStr] = await Promise.all([getDocs(qPrevNum), getDocs(qPrevStr)]);
    const pushDocPrev = (d: any) => {
      const data = d.data?.() ?? d.data;
      const timeId = data?.timeId;
      const turmaId = String(data?.turmaId || "");
      if (!timeId || !turmaId) return;
      if (porTimeGlobal.has(timeId)) return; // já tem decisão desta rodada
      // Monta a decisão traduzindo níveis para os mesmos campos numéricos
      const preco = Number(data.preco ?? 100);
      const qualidade = mapProdutoToQualidade(String(data.produtoNivel ?? data.produto ?? "Básico"));
      const marketingBonus = mapMarketingToBonus(String(data.marketingPacote ?? data.marketing ?? "Local"));
      const equipeBonus = mapEquipeToBonus(String(data.equipeNivel ?? data.equipe ?? "Enxuto"));
      const beneficioBonus = mapBeneficioToBonus(String(data.beneficio ?? "Nenhum"));
      const capacidade = mapCapacidadeToValue(data.capacidadeNivel ?? data.capacidade ?? 0);
      porTimeGlobal.set(timeId, {
        timeId,
        preco,
        qualidade,
        marketingBonus,
        equipeBonus,
        beneficioBonus,
        capacidade,
        publicoAlvo: data.publicoAlvo || undefined,
        // preserva timestamp original apenas como referência
        timestamp: data.timestamp,
        turmaId,
      } as any);
      usedPrevByTime.set(timeId, true);
    };
    snapPrevNum.forEach(pushDocPrev);
    snapPrevStr.forEach(pushDocPrev);
    if (usedPrevByTime.size > 0) {
      console.warn("[DEBUG][global] Fallback: usando decisões da rodada anterior para times sem decisão nesta rodada:", Array.from(usedPrevByTime.keys()));
    }
  }

  const decisoesGlobal: DecisaoExt[] = Array.from(porTimeGlobal.values());
  // Aviso se continuarmos sem nenhuma decisão (nem atual nem anterior)
  if (decisoesGlobal.length === 0) {
    console.warn("[DEBUG][global] Nenhuma decisão encontrada na rodada atual nem na anterior. Abortando fechamento.");
    console.groupEnd();
    return { ok: true, turmas: [], rodada };
  }
  const turmas = Array.from(new Set(decisoesGlobal.map((d) => d.turmaId)));
  console.log("[DEBUG][global] Times na rodada:", decisoesGlobal.length,
              "Turmas envolvidas:", turmas);

  // 3) Cálculo de EA por time (pré-share)
  const precoMedioMercado = Number(geral.refPrice ?? 100);

  // marketSize randômico (por rodada): tenta ler de configuracoes/geral/rodadas/rodada_<rodada>, cai no geral se não houver
  let marketSize: number;
  try {
    const rodadaDoc = await getDoc(doc(db, "configuracoes", "geral", "rodadas", `rodada_${rodada}`));
    if (rodadaDoc.exists()) {
      const rdata = rodadaDoc.data() as any;
      marketSize = Number(rdata.marketSize ?? geral.marketSize ?? 10000);
      console.log("[DEBUG] marketSize (rodada):", marketSize);
    } else {
      marketSize = Number(geral.marketSize ?? 10000);
      console.warn("[DEBUG] rodada sem marketSize específico; usando geral:", marketSize);
    }
  } catch (e) {
    marketSize = Number(geral.marketSize ?? 10000);
    console.warn("[DEBUG] erro ao ler marketSize da rodada; usando geral:", marketSize, e);
  }

  const EAs = decisoesGlobal.map((d) => {
    const publico = d.publicoAlvo || "Adultos (25–40 anos)";
    const benefTipo = beneficioFromBonus(d.beneficioBonus);
    const extra = beneficioBonusExtra[`${benefTipo}|${publico}`] ?? 0;
    const benef = d.beneficioBonus + extra;

    const eaBase =
      (100 - Math.max(1, d.preco)) +
      (d.qualidade ?? 0) * (qualidadeMult[publico] ?? 1) +
      (d.marketingBonus ?? 0) * (marketingMult[publico] ?? 1) +
      (d.equipeBonus ?? 0) * (equipeMult[publico] ?? 1) +
      benef;

    return Number(eaBase.toFixed(4));
  });

  // 4) Competição GLOBAL (todas as turmas juntas)
  const { vendasEfetivas, backlogs, shares } = calcularCompeticaoPorPublico(
    decisoesGlobal as Decisao[],
    EAs,
    marketSize,
    precoMedioMercado
  );

  // 5) Financeiro por time + satisfação/backlog
  const receitas: number[] = [];
  const custos: number[] = [];
  const lucrosRaw: number[] = [];
  const cvus: number[] = [];
  const satisfacoes: number[] = [];

  for (let i = 0; i < decisoesGlobal.length; i++) {
    const d = decisoesGlobal[i];
    const publico = d.publicoAlvo || "Adultos (25–40 anos)";
    const preco = Math.max(1, d.preco);
    const vendas = vendasEfetivas[i];
    const houveBacklog = backlogs[i];

    // penalidade de satisfação por backlog
    let eaAdj = EAs[i];
    if (houveBacklog) {
      if (["Jovens (15–24 anos)", "Classe C/D"].includes(publico)) eaAdj -= 15;
      else if (["Sêniores (40+)", "Classe A/B"].includes(publico)) eaAdj -= 5;
    }

    const receita = vendas * preco;

    // eficiência simples: capacidade/100
    const eficiencia = (d.capacidade || 0) / 100;
    const cvu = calcularCVU(d.qualidade || 0, eficiencia || 0);
    const custoVariavel = vendas * cvu;

    const benefTipo = beneficioFromBonus(d.beneficioBonus);
    const extra = beneficioBonusExtra[`${benefTipo}|${publico}`] ?? 0;
    const benef = d.beneficioBonus + extra;

    const custoMarketing = (d.marketingBonus || 0) * 1000;
    const custoEquipe = (d.equipeBonus || 0) * 1000;
    const custoBeneficio = benef * 1000;
    const fixedTeamCost = 5000; // custo fixo por rodada
    const custoTotal = custoVariavel + custoMarketing + custoEquipe + custoBeneficio + fixedTeamCost;

    const lucro = receita - custoTotal;

    receitas.push(Number(receita.toFixed(2)));
    custos.push(Number(custoTotal.toFixed(2)));
    lucrosRaw.push(Number(lucro.toFixed(2)));
    cvus.push(Number(cvu.toFixed(2)));
    satisfacoes.push(Math.min(100, eaAdj / 2));
  }

  // Amortecer lucros extremos
  const lucros = windfallDamping(lucrosRaw, 0.2).map((n) => Number(n.toFixed(2)));

  // === Lucro acumulado até a rodada atual (soma das rodadas anteriores + atual) ===
  async function somarLucroAnterior(turmaId: string, timeId: string, rodadaAtual: number): Promise<number> {
    let sum = 0;
    for (let r = 1; r < rodadaAtual; r++) {
      const ref = doc(db, "resultadosOficiais", turmaId, `rodada_${r}`, timeId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d: any = snap.data();
        const l = Number(d?.lucro ?? 0);
        if (Number.isFinite(l)) sum += l;
      }
    }
    return Number(sum.toFixed(2));
  }
  const lucroAcumulados = await Promise.all(
    decisoesGlobal.map(async (d, i) => {
      const prev = await somarLucroAnterior(d.turmaId, d.timeId, rodada);
      return Number((prev + (lucros[i] ?? 0)).toFixed(2));
    })
  );

  /* =========================== Persistência Firebase =========================== */

  // === Idempotência: já aplicamos carry desta rodada para este time? ===
  const resRefs = decisoesGlobal.map((d) => doc(db, "resultadosOficiais", d.turmaId, `rodada_${rodada}`, d.timeId));
  const resSnaps = await Promise.all(resRefs.map((r) => getDoc(r)));
  const carryAppliedByTime = new Map<string, boolean>();
  for (let i = 0; i < resSnaps.length; i++) {
    const timeId = decisoesGlobal[i].timeId;
    const applied = (resSnaps[i].data() as any)?.carryApplied === true;
    carryAppliedByTime.set(timeId, applied);
  }

  const batch = writeBatch(db);
  const agora = Timestamp.now();

  // 5.1) Gravar resultados oficiais por turma/time (com carry 20% → orçamento)
  for (let i = 0; i < decisoesGlobal.length; i++) {
    const d = decisoesGlobal[i];
    const timeId = d.timeId;
    const turmaId = d.turmaId;

    const { reinvestimento, caixaDelta } = splitProfit(lucros[i], 0.2);

    const resRef = doc(db, "resultadosOficiais", turmaId, `rodada_${rodada}`, timeId);
    const jaAplicado = carryAppliedByTime.get(timeId) === true;

    // Se já aplicou carry antes, não incremente saldos novamente
    if (!jaAplicado) {
      // Atualiza saldos do time (20/80) — coleção times
      const timeRef = doc(db, "times", timeId);
      batch.set(
        timeRef,
        { cash: increment(caixaDelta), reinvestBudget: increment(reinvestimento) },
        { merge: true }
      );

      // Atualiza também a coleção empresas, refletindo "orcamento disponível para investimento"
      const empRef = doc(db, "empresas", timeId);
      batch.set(
        empRef,
        { orcamentoDisponivel: increment(reinvestimento) },
        { merge: true }
      );
    }

    // grava/atualiza resultado oficial da rodada
    const resultado: Resultado = {
      timeId,
      ea: Number(EAs[i].toFixed(2)),
      share: Number((shares[i] * 100).toFixed(2)),
      demanda: vendasEfetivas[i],
      // @ts-ignore compat
      vendas: vendasEfetivas[i],
      // @ts-ignore registrar market size usado na rodada
      marketSize,
      receita: receitas[i],
      custo: custos[i],
      lucro: lucros[i],
      lucroAcumulado: lucroAcumulados[i],
      reinvestimento,
      caixaFinal: caixaDelta,
      cvu: cvus[i],
      backlog: backlogs[i],
      satisfacao: Number(satisfacoes[i].toFixed(1)),
      status: "✅ OFICIAL",
      oficial: true,
      timestamp: agora,
    };

    // Marcar carryApplied true caso o crédito tenha sido aplicado agora
    batch.set(resRef, { ...resultado, carryApplied: jaAplicado ? true : true }, { merge: true });
  }

  // 5.2) Gravar rankings por TURMA usando os mesmos resultados (filtrando por turma)
  for (const turmaId of turmas) {
    const idxs = decisoesGlobal
      .map((d, i) => ({ turmaId: d.turmaId, i }))
      .filter((x) => x.turmaId === turmaId)
      .map((x) => x.i);

    const items = idxs.map((i) => ({
      timeId: decisoesGlobal[i].timeId,
      lucroRodada: Number(lucros[i]),
      lucroAcumulado: Number(lucroAcumulados[i]),
      caixaFinal: splitProfit(lucros[i], 0.2).caixaDelta,
    }));
    // Ordenar pelo lucro acumulado (desc)
    items.sort((a, b) => b.lucroAcumulado - a.lucroAcumulado);

    const rankingSummaryRef = doc(collection(db, "rankings", turmaId, `rodada_${rodada}`), "summary");
    batch.set(rankingSummaryRef, { geradoEm: agora, rodada, criterio: "lucroAcumulado", items }, { merge: false });

    for (const it of items) {
      const perTeamRef = doc(collection(db, "rankings", turmaId, `rodada_${rodada}`), it.timeId);
      batch.set(perTeamRef, it, { merge: false });
    }
  }

  console.log("[DEBUG][global] batch commit para turmas:", turmas);
  await batch.commit();
  console.log("[DEBUG][global] ✅ commit finalizado");

  // rodada encerrada (você controla o incremento no painel)
  await setDoc(doc(db, "configuracoes", "geral"), { rodadaAtiva: false }, { merge: true });

  console.log("[DEBUG] Rodada encerrada:", rodada, "Turmas:", turmas);
  console.groupEnd();
  return { ok: true, turmas, rodada };
}

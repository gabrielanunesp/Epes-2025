// src/services/fechamentoLocal.ts
import {
  collection, getDocs, doc, getDoc, setDoc, writeBatch, query, where
} from "firebase/firestore";
import { db } from "../services/firebase";

// === Funções auxiliares ===
function calcularCVU(qualidade: number, eficiencia: number): number {
  const base = 20, alpha = 0.2, beta = 0.1;
  const q = Math.max(0, qualidade ?? 0);
  const e = Math.max(0, eficiencia ?? 0);
  return Math.max(0, Number((base + alpha*q - beta*e).toFixed(2)));
}

function beneficioFromBonus(b:number){
  if (b === 10) return "Cupom";
  if (b === 15) return "Brinde";
  if (b === 20) return "Frete grátis";
  return "Nenhum";
}

function softmax(scores:number[]){
  if (scores.length === 0) return [];
  const m = Math.max(...scores);
  const exps = scores.map(s=>Math.exp(s-m));
  const sum = exps.reduce((a,b)=>a+b,0)||1;
  return exps.map(v=>v/sum);
}

function windfallDamping(profits:number[], alpha=0.2){
  if (profits.length <= 2) return profits;
  const s = [...profits].sort((a,b)=>a-b);
  const med = s[Math.floor(s.length/2)];
  const abs = profits.map(p=>Math.abs(p-med)).sort((a,b)=>a-b);
  const mad = abs[Math.floor(abs.length/2)] || 1;
  const thr = med + 1.5*mad;
  return profits.map(p => p<=thr ? p : thr + (p-thr)*(1-alpha));
}

function splitProfit(lucro:number, rate=0.2){
  const pos = Math.max(0, lucro);
  return {
    reinvestimento: Number((pos*rate).toFixed(2)),
    caixaDelta: Number((pos*(1-rate)).toFixed(2)),
  };
}

// === Multiplicadores por público-alvo ===
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

// === Tipos ===
type Decisao = {
  timeId: string;
  preco: number;
  qualidade: number;
  marketingBonus: number;
  equipeBonus: number;
  beneficioBonus: number;
  capacidade: number;
  publicoAlvo?: string;
  timestamp?: any;
};

type Resultado = {
  timeId: string;
  ea: number;
  share: number;
  demanda: number;
  receita: number;
  custo: number;
  lucro: number;
  reinvestimento: number;
  caixaFinal: number;
  cvu: number;
  backlog: boolean;
  satisfacao: number;
  status: string;
  oficial: true;
  timestamp: any;
};
export async function fecharRodadaLocal(params?: {
  turma?: string;
  rodada?: number;
}): Promise<{ ok: boolean; turmas: string[]; rodada: number }> {
  // 1) Lê configuracoes/geral
  const geralSnap = await getDoc(doc(db, "configuracoes", "geral"));
  if (!geralSnap.exists()) throw new Error("configuracoes/geral não encontrado.");
  const geral = geralSnap.data() as any;
  const rodadaAtual = Number(geral.rodadaAtual ?? 1);
  const rodada = Number.isFinite(params?.rodada) && (params!.rodada as number) > 0
    ? (params!.rodada as number) : rodadaAtual;

  // 2) Quais turmas?
  let turmas: string[] = [];
  if (params?.turma) {
    turmas = [params.turma];
  } else {
    const empSnap = await getDocs(collection(db, "empresas"));
    turmas = empSnap.docs.map(d => d.id);
    if (turmas.length === 0) {
      const tSnap = await getDocs(collection(db, "times"));
      const set = new Set<string>();
      tSnap.docs.forEach(d => {
        const ct = (d.data() as any)?.codigoTurma;
        if (ct) set.add(ct);
      });
      turmas = Array.from(set);
    }
  }

  // 3) Processar cada turma
  for (const turmaId of turmas) {
    const rodadaCol = collection(db, "rodadas", turmaId, `rodada${rodada}`);
    const snap = await getDocs(rodadaCol);

    // Pega a decisão mais recente por time
    const porTime = new Map<string, Decisao>();
    snap.docs.forEach(d => {
      if (d.id.startsWith("resultado_")) return;
      const data = d.data() as any;
      if (!data?.timeId) return;
      const atual = porTime.get(data.timeId);
      const tsNew = data.timestamp?.seconds ?? 0;
      const tsOld = (atual as any)?.timestamp?.seconds ?? -1;
      if (!atual || tsNew > tsOld) {
        porTime.set(data.timeId, {
          timeId: data.timeId,
          preco: Number(data.preco ?? 100),
          qualidade: Number(data.qualidade ?? 0),
          marketingBonus: Number(data.marketingBonus ?? 0),
          equipeBonus: Number(data.equipeBonus ?? 0),
          beneficioBonus: Number(data.beneficioBonus ?? 0),
          capacidade: Number(data.capacidade ?? 0),
          publicoAlvo: data.publicoAlvo || undefined,
          timestamp: data.timestamp,
        });
      }
    });

    // Lista de times da turma
    let timesIds: string[] = [];
    try {
      const qTimes = query(collection(db, "times"), where("codigoTurma", "==", turmaId));
      const tSnap = await getDocs(qTimes);
      timesIds = tSnap.docs.map(d => d.id);
    } catch {
      timesIds = Array.from(new Set(Array.from(porTime.values()).map(v => v.timeId)));
    }

    // Decisões finais
    const decisoes: Decisao[] = timesIds.map(timeId => {
      const d = porTime.get(timeId);
      if (d) return d;
      return {
        timeId,
        preco: 999,
        qualidade: 0,
        marketingBonus: 0,
        equipeBonus: 0,
        beneficioBonus: 0,
        capacidade: 0,
        publicoAlvo: undefined,
        timestamp: undefined,
      };
    });

    const precoMedioMercado = 100;
    const marketSize = 10000;
    // EA por time
    const EAs = decisoes.map(d => {
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

    // shares via softmax
    const shares = softmax(EAs);

    // === AJUSTE: limitar vendas por público-alvo ===
    const grupos: Record<string, number[]> = {};
    decisoes.forEach((d, i) => {
      const publico = d.publicoAlvo || "Adultos (25–40 anos)";
      if (!grupos[publico]) grupos[publico] = [];
      grupos[publico].push(i);
    });

    const vendasEfetivas: number[] = [];
    const backlogs: boolean[] = [];

    for (const publico in grupos) {
      const indices = grupos[publico];
      const totalDemanda = indices.reduce((sum, i) => {
        const preco = Math.max(1, decisoes[i].preco);
        const eps = elasticidadePreco[publico] ?? 1.0;
        const fatorPreco = Math.pow(precoMedioMercado / preco, eps);
        return sum + marketSize * shares[i] * fatorPreco;
      }, 0);

      const limite = marketSize;
      const fator = totalDemanda > limite ? limite / totalDemanda : 1;

      indices.forEach(i => {
        const preco = Math.max(1, decisoes[i].preco);
        const eps = elasticidadePreco[publico] ?? 1.0;
        const fatorPreco = Math.pow(precoMedioMercado / preco, eps);
        const demandaBruta = marketSize * shares[i] * fatorPreco;
        const demandaAjustada = demandaBruta * fator;
        const vendas = Math.min(demandaAjustada, Math.max(0, decisoes[i].capacidade));
        vendasEfetivas[i] = Math.round(vendas);
        backlogs[i] = demandaAjustada > decisoes[i].capacidade;
      });
    }
    const receitas: number[] = [];
    const custos: number[] = [];
    const lucrosRaw: number[] = [];
    const cvus: number[] = [];
    const satisfacoes: number[] = [];

    for (let i = 0; i < decisoes.length; i++) {
      const d = decisoes[i];
      const publico = d.publicoAlvo || "Adultos (25–40 anos)";
      const preco = Math.max(1, d.preco);
      const vendas = vendasEfetivas[i];
      const houveBacklog = backlogs[i];

      // Penalidade de satisfação por backlog
      let eaAdj = EAs[i];
      if (houveBacklog) {
        if (["Jovens (15–24 anos)", "Classe C/D"].includes(publico)) eaAdj -= 15;
        else if (["Sêniores (40+)", "Classe A/B"].includes(publico)) eaAdj -= 5;
      }

      const receita = vendas * preco;
      const eficiencia = (d.capacidade || 0) / 100;
      const cvu = calcularCVU(d.qualidade || 0, eficiencia || 0);
      const custoVariavel = vendas * cvu;

      const benefTipo = beneficioFromBonus(d.beneficioBonus);
      const extra = beneficioBonusExtra[`${benefTipo}|${publico}`] ?? 0;
      const benef = d.beneficioBonus + extra;

      const custoMarketing = (d.marketingBonus || 0) * 1000;
      const custoEquipe = (d.equipeBonus || 0) * 1000;
      const custoBeneficio = benef * 1000;

      const custoTotal = custoVariavel + custoMarketing + custoEquipe + custoBeneficio;
      const lucro = receita - custoTotal;

      receitas.push(Number(receita.toFixed(2)));
      custos.push(Number(custoTotal.toFixed(2)));
      lucrosRaw.push(Number(lucro.toFixed(2)));
      cvus.push(Number(cvu.toFixed(2)));
      satisfacoes.push(Math.min(100, eaAdj / 2));
    }

    // Amortecedor anti “ganho desproporcional”
    const lucros = windfallDamping(lucrosRaw, 0.2).map(n => Number(n.toFixed(2)));
    // Grava resultados oficiais + atualiza times
    const batch = writeBatch(db);
    const agora = new Date();

    for (let i = 0; i < decisoes.length; i++) {
      const timeId = decisoes[i].timeId;
      const { reinvestimento, caixaDelta } = splitProfit(lucros[i], 0.2);

      // Atualiza times (20/80)
      const timeRef = doc(db, "times", timeId);
      batch.set(timeRef, {
        cash: (window as any).firebase?.firestore?.FieldValue?.increment
          ? (window as any).firebase.firestore.FieldValue.increment(caixaDelta)
          : undefined,
        reinvestBudget: (window as any).firebase?.firestore?.FieldValue?.increment
          ? (window as any).firebase.firestore.FieldValue.increment(reinvestimento)
          : undefined,
      }, { merge: true });

      // Resultado OFICIAL na própria coleção da rodada
      const resRef = doc(db, "rodadas", turmaId, `rodada${rodada}`, `resultado_${timeId}`);
      batch.set(resRef, {
        timeId,
        ea: Number(EAs[i].toFixed(2)),
        share: Number((shares[i] * 100).toFixed(2)),
        demanda: vendasEfetivas[i],
        receita: receitas[i],
        custo: custos[i],
        lucro: lucros[i],
        reinvestimento,
        caixaFinal: caixaDelta,
        cvu: cvus[i],
        backlog: backlogs[i],
        satisfacao: Number(satisfacoes[i].toFixed(1)),
        status: "✅ OFICIAL",
        oficial: true,
        timestamp: agora,
      } as Resultado, { merge: true });
    }

    await batch.commit();
  }

  // Fecha a rodada (não incrementa a próxima; você decide isso no painel)
  await setDoc(doc(db, "configuracoes", "geral"), { rodadaAtiva: false }, { merge: true });

  return { ok: true, turmas, rodada };
}

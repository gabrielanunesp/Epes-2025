export interface ResultadoRodada {
  ea: number;
  demanda: number;
  receita: number;
  custo: number;
  lucro: number;
  reinvestimento: number;
  caixaFinal: number;
  cvu: number;
  backlog: boolean;
  satisfacao: number;
  evento?: string;
  share?: number;           // % para UI (compatível com seu código)
  // novo, útil para cálculos:
  shareFraction?: number;   // 0..1
}

export function calcularCVU(qualidade: number, eficiencia: number): number {
  // sua fórmula mantida, mas use eficiência coerente (0..100)
  const base = 20;
  const alpha = 0.2;
  const beta = 0.1;
  const cvu = base + alpha * qualidade - beta * eficiencia;
  return Math.max(0, parseFloat(cvu.toFixed(2)));
}

// ===== helpers locais =====
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// score de preço relativo ao preço de referência (P*)
function priceScore(p: number, refPrice: number) {
  const denom = 0.5 * refPrice; // deslocar ±50% leva score ~0
  return clamp(1 - (p - refPrice) / denom, 0, 1); // 0..1
}

// transforma “marketingBonus” em um score suave (0..1)
function marketingScoreFromBonus(bonusPct: number, boost: number) {
  const spend = Math.max(0, bonusPct) * 1000; // compatível com seu custo
  const raw = Math.log(1 + spend) / 10;
  return clamp((1 + boost) * raw, 0, 1);
}

// sigmóide: 0..1, controla “propensão de compra” via EA
function sigmoid(x: number, x0: number, k: number) {
  return 1 / (1 + Math.exp(-(x - x0) / k));
}

export function calcularRodada(d: {
  preco: number;
  qualidade: number;
  marketingBonus: number;
  equipeBonus: number;
  beneficioBonus: number;
  capacidade: number;
  publicoAlvo: string;
  caixaAcumulado: number;
  precoMedioMercado?: number;  // P*
  marketSize?: number;
  eaDosOutrosTimes?: number[]; // ignorado neste modo “vs mercado”
}): ResultadoRodada {
  const {
    preco,
    qualidade,
    marketingBonus,
    equipeBonus,
    beneficioBonus,
    capacidade,
    publicoAlvo,
    caixaAcumulado,
    precoMedioMercado = 100,
    marketSize = 10000,
  } = d;

  // ===== mapas do seu código (mantidos) =====
  const qualidadeMultiplicador: Record<string, number> = {
    "Jovens (15–24 anos)": 0.8,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 1.2,
    "Classe A/B": 1.25,
    "Classe C/D": 0.8,
  };

  const marketingMultiplicador: Record<string, number> = {
    "Jovens (15–24 anos)": 1.3,
    "Adultos (25–40 anos)": 1.0,
    "Sêniores (40+)": 1.2,
    "Classe A/B": 1.1,
    "Classe C/D": 1.15,
  };

  const equipeMultiplicador: Record<string, number> = {
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

  // ===== parâmetros padrão da “temporada” (podem vir do banco depois) =====
  const refPrice = precoMedioMercado;   // P*
  const fixedTeamCost = 5000;           // custo fixo por rodada (padrão)
  const ea50 = 100;                     // EA onde propensão = 0.5
  const eaK = 30;                       // inclinação da sigmóide

  // ===== normalizações =====
  const publico = (publicoAlvo || "").trim();
  const eps = elasticidadePreco[publico] ?? 1.0;

  const p = preco > 0 ? preco : refPrice;
  const q = qualidade ?? 0;
  const mktBonus = marketingBonus ?? 0;
  const eqBonus = equipeBonus ?? 0;

  // tipo de benefício + bônus extra por público
  const beneficioTipo =
    beneficioBonus === 10 ? "Cupom" :
    beneficioBonus === 15 ? "Brinde" :
    beneficioBonus === 20 ? "Frete grátis" : "Nenhum";
  const bonusExtra = beneficioBonusExtra[`${beneficioTipo}|${publico}`] ?? 0;
  const beneficio = beneficioBonus + bonusExtra;

  // ===== EA (linear) =====
  const pScore = priceScore(p, refPrice); // 0..1
  const mScore = marketingScoreFromBonus(mktBonus, (marketingMultiplicador[publico] ?? 1) - 1); // 0..1

  const eaLinear =
    (100 * pScore) +                                   // preço relativo (0..100)
    q * (qualidadeMultiplicador[publico] ?? 1) +       // qualidade ponderada
    (mScore * 100) +                                   // marketing (0..100)
    eqBonus * (equipeMultiplicador[publico] ?? 1) +    // equipe ponderada
    beneficio;                                         // benefício

  // ===== Procura “vs mercado” =====
  const propensao = sigmoid(eaLinear, ea50, eaK);      // 0..1
  const fatorPreco = Math.pow(refPrice / p, eps);      // elasticidade
  const demandaBruta = marketSize * propensao * fatorPreco;

  // ===== Vendas & backlog =====
  const vendas = Math.min(demandaBruta, capacidade);
  const houveBacklog = demandaBruta > capacidade;

  // ===== Eficiência coerente (0..100) =====
  const eficiencia = Math.min(100, 50 + eqBonus);      // proxy simples: base 50 + bônus de equipe
  const cvu = calcularCVU(q, eficiencia);

  // ===== Custos =====
  const custoVariavel = vendas * cvu;
  const custoMarketing = mktBonus * 1000;
  const custoEquipe = eqBonus * 1000;
  const custoBeneficio = beneficio * 1000;
  const custoTotal = custoVariavel + custoMarketing + custoEquipe + custoBeneficio + fixedTeamCost;

  // ===== Resultado financeiro =====
  const receita = vendas * p;
  const lucroBruto = receita - custoTotal;
  const reinvestimento = Math.max(0, lucroBruto) * 0.2;
  const caixaFinal = caixaAcumulado + Math.max(0, lucroBruto) * 0.8;

  // ===== Share “potencial” (fração do mercado) =====
  const shareFraction = demandaBruta / marketSize;     // 0..>1 (normalmente 0..1)
  const sharePct = parseFloat((clamp(shareFraction, 0, 1) * 100).toFixed(2));

  return {
    ea: parseFloat(eaLinear.toFixed(2)),
    demanda: Math.round(demandaBruta),
    receita: parseFloat(receita.toFixed(2)),
    custo: parseFloat(custoTotal.toFixed(2)),
    lucro: parseFloat(lucroBruto.toFixed(2)),
    reinvestimento: parseFloat(reinvestimento.toFixed(2)),
    caixaFinal: parseFloat(caixaFinal.toFixed(2)),
    cvu: parseFloat(cvu.toFixed(2)),
    backlog: houveBacklog,
    satisfacao: Math.min(100, eaLinear / 2),
    // ⚠️ aplicar a penalidade de backlog NA PRÓXIMA RODADA (no server)
    evento: houveBacklog ? "PENALIDADE_NEXT" : undefined,
    share: sharePct,                // em % para UI (compatível)
    shareFraction                   // fração 0..1 (novo)
  };
}

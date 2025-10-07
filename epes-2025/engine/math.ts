import type { PublicTarget, SeasonParams, TeamDecision, WeightVector } from './types.js';

export const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export const priceScore = (price: number, refPrice: number) => {
  const safeRef = Math.max(refPrice, 0.01);
  const denom = 0.5 * safeRef;
  return clamp(1 - (price - safeRef) / denom, 0, 1);
};

export const marketingScore = (spend: number, boost = 0) => {
  const safeSpend = Math.max(0, spend);
  const raw = Math.log1p(safeSpend);
  return clamp(((1 + boost) * raw) / 10, 0, 1);
};

export const tunedWeights = (base: WeightVector, target?: PublicTarget | null) => {
  const deltas = target?.deltas ?? {};
  return {
    price: base.price + (deltas.price ?? 0),
    quality: base.quality + (deltas.quality ?? 0),
    marketing: base.marketing + (deltas.marketing ?? 0),
    cx: base.cx + (deltas.cx ?? 0),
  };
};

export const computeEA = (
  weights: WeightVector,
  team: TeamDecision,
  refPrice: number,
  publicTarget?: PublicTarget | null
) => {
  const priceComponent = priceScore(team.price, refPrice);
  const marketingComponent = marketingScore(team.marketingSpend, publicTarget?.marketingBoost ?? 0);
  const qualityComponent = clamp(team.quality / 100, 0, 1);
  const cxComponent = clamp(team.cx / 100, 0, 1);

  const eaLinear =
    weights.price * priceComponent +
    weights.quality * qualityComponent +
    weights.marketing * marketingComponent +
    weights.cx * cxComponent;

  const ea = eaLinear * (1 + (team.launchEA ?? 0)) * (1 + (team.brandEA ?? 0));

  return { eaLinear, ea, components: { priceComponent, qualityComponent, marketingComponent, cxComponent } };
};

export const softmax = (values: number[], beta: number) => {
  if (values.length === 0) return [] as number[];
  const safeBeta = Number.isFinite(beta) ? beta : 1;
  const scaled = values.map((v) => v * safeBeta);
  const max = Math.max(...scaled);
  const expValues = scaled.map((v) => Math.exp(v - max));
  const sum = expValues.reduce((acc, v) => acc + v, 0);
  if (sum === 0) {
    const equal = 1 / values.length;
    return values.map(() => equal);
  }
  return expValues.map((v) => v / sum);
};

export const capShares = (shares: number[], cap?: number | null) => {
  if (!shares.length) return shares;
  if (cap === undefined || cap === null) return shares;
  const safeCap = Math.max(0, Math.min(1, cap));
  const result = new Array<number>(shares.length).fill(0);
  const fixed = new Array<boolean>(shares.length).fill(false);
  let remainingTotal = 1;
  let iteration = 0;
  while (iteration < shares.length + 1) {
    iteration += 1;
    const activeIndices = shares
      .map((_, idx) => idx)
      .filter((idx) => !fixed[idx]);
    if (activeIndices.length === 0) break;
    const activeSum = activeIndices.reduce((acc, idx) => acc + shares[idx], 0);
    let cappedAny = false;
    for (const idx of activeIndices) {
      const proposed = (shares[idx] / activeSum) * remainingTotal;
      if (proposed > safeCap + 1e-9) {
        result[idx] = safeCap;
        remainingTotal -= safeCap;
        fixed[idx] = true;
        cappedAny = true;
      }
    }
    if (!cappedAny) {
      for (const idx of activeIndices) {
        result[idx] = (shares[idx] / activeSum) * remainingTotal;
      }
      break;
    }
  }
  const filled = result.reduce((acc, val) => acc + val, 0);
  if (filled < 1 - 1e-9) {
    // distribute any remaining equally among active slots within cap (should be zero but guard for rounding)
    const slack = 1 - filled;
    const flexible = result.map((val, idx) => ({ idx, val })).filter((item) => !fixed[item.idx]);
    const per = flexible.length ? slack / flexible.length : 0;
    for (const item of flexible) {
      result[item.idx] = Math.min(result[item.idx] + per, safeCap);
    }
  }
  return result;
};

export const demandRaw = (
  marketSize: number,
  share: number,
  price: number,
  refPrice: number,
  elasticity: number
) => {
  const safePrice = Math.max(price, 0.01);
  const priceFactor = Math.pow(refPrice / safePrice, elasticity);
  return marketSize * share * priceFactor;
};

export const unitCost = (team: TeamDecision, season: SeasonParams) => {
  const { cvuBase, kQuality, kEfficiency } = season.costs;
  const qualityFactor = (team.quality ?? 0) / 100;
  const efficiencyFactor = (team.efficiency ?? 0) / 100;
  const cost = cvuBase + kQuality * qualityFactor - kEfficiency * efficiencyFactor;
  return Math.max(cost, 0);
};

export const windfallDamping = (profits: number[], alpha?: number | null) => {
  const safeAlpha = alpha ?? 0;
  if (safeAlpha <= 0 || profits.length === 0) return profits.slice();
  const sorted = profits.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const deviations = profits.map((p) => Math.abs(p - median));
  const sortedDev = deviations.slice().sort((a, b) => a - b);
  const mad = sortedDev.length % 2 === 0
    ? (sortedDev[sortedDev.length / 2 - 1] + sortedDev[sortedDev.length / 2]) / 2
    : sortedDev[Math.floor(sortedDev.length / 2)];
  const threshold = median + safeAlpha * mad;
  return profits.map((p) => (p > threshold ? threshold + (p - threshold) * 0.5 : p));
};

export const splitProfit = (profit: number, reinvestRate: number) => {
  if (profit <= 0) {
    return { reinvest: 0, cashToFinal: 0 };
  }
  const reinvest = profit * reinvestRate;
  const cashToFinal = profit - reinvest;
  return { reinvest, cashToFinal };
};

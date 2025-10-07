import {
  clamp,
  computeEA,
  demandRaw,
  marketingScore,
  priceScore,
  softmax,
  capShares,
  splitProfit,
  tunedWeights,
  unitCost,
  windfallDamping,
} from './math.js';
import type {
  ComputeRoundInput,
  ComputeRoundOutput,
  PublicTarget,
  SeasonParams,
  TeamDecision,
  TeamRoundResult,
} from './types.js';

export {
  clamp,
  computeEA,
  demandRaw,
  marketingScore,
  priceScore,
  softmax,
  capShares,
  splitProfit,
  tunedWeights,
  unitCost,
  windfallDamping,
};

const indexById = <T extends { id: string }>(items: T[]) => {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
};

const safeNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
};

const ensurePositive = (value: number, fallback = 0) => (Number.isFinite(value) && value > 0 ? value : fallback);

const normalizeShares = (shares: number[]) => {
  const total = shares.reduce((acc, val) => acc + val, 0);
  if (total <= 0) {
    const equal = shares.length ? 1 / shares.length : 0;
    return shares.map(() => equal);
  }
  return shares.map((share) => share / total);
};

const mapPublicTarget = (publicTargets: PublicTarget[], id: string) => {
  const map = indexById(publicTargets);
  return map.get(id);
};

const computeBenefitCost = (team: TeamDecision, season: SeasonParams) => {
  if (team.benefitCostOverride !== undefined && team.benefitCostOverride !== null) {
    return Math.max(team.benefitCostOverride, 0);
  }
  return Math.max(season.costs.benefitCost ?? 0, 0);
};

export const computeRound = (input: ComputeRoundInput): ComputeRoundOutput => {
  const { season, teams, publicTargets, round } = input;
  const refPrice = safeNumber(season.refPrice, 1);
  const marketSize = safeNumber(round.marketSize, 0);
  const weightsMap = indexById(publicTargets);
  const beta = safeNumber(season.softmaxBeta, 1);

  const enriched = teams.map((team) => {
    const target = weightsMap.get(team.publicTargetId) ?? null;
    const weights = tunedWeights(season.weights, target ?? undefined);
    const eaInfo = computeEA(weights, team, refPrice, target ?? undefined);
    return { team, target, weights, eaInfo };
  });

  const softmaxInput = enriched.map((item) => item.eaInfo.ea);
  let shares = softmax(softmaxInput, beta);
  shares = capShares(shares, season.shareCap ?? undefined);
  shares = normalizeShares(shares);

  const demandList = enriched.map((item, idx) => {
    const elasticity = item.target?.elasticity ?? 1;
    return demandRaw(marketSize, shares[idx], ensurePositive(item.team.price, refPrice), refPrice, elasticity);
  });

  const preliminarySales = demandList.map((demand, idx) => Math.min(demand, ensurePositive(enriched[idx].team.capacity)));
  const totalPreliminary = preliminarySales.reduce((acc, v) => acc + v, 0);
  const capacityFlags = demandList.map((demand, idx) => demand > ensurePositive(enriched[idx].team.capacity));

  let sales = preliminarySales.slice();
  if (totalPreliminary > marketSize && marketSize > 0) {
    const scale = marketSize / totalPreliminary;
    sales = preliminarySales.map((value) => value * scale);
  }

  const unitCosts = enriched.map((item) => unitCost(item.team, season));

  const results: TeamRoundResult[] = enriched.map((item, idx) => {
    const team = item.team;
    const marketingCost = Math.max(team.marketingSpend, 0);
    const fixedCost = Math.max(season.costs.fixedTeamCost, 0);
    const benefitCost = computeBenefitCost(team, season);
    const variableCost = unitCosts[idx] * sales[idx];
    const revenue = sales[idx] * ensurePositive(team.price, refPrice);
    const profitRaw = revenue - variableCost - marketingCost - fixedCost - benefitCost;
    return {
      teamId: team.teamId,
      name: team.name,
      publicTargetId: team.publicTargetId,
      eaLinear: item.eaInfo.eaLinear,
      ea: item.eaInfo.ea,
      share: shares[idx],
      demandRaw: demandList[idx],
      capacity: ensurePositive(team.capacity),
      sales: sales[idx],
      revenue,
      unitCost: unitCosts[idx],
      variableCost,
      marketingCost,
      fixedCost,
      benefitCost,
      profitRaw,
      profit: profitRaw, // placeholder updated below
      reinvest: 0,
      cashToFinal: 0,
      price: ensurePositive(team.price, refPrice),
      marketingSpend: marketingCost,
      flags: {
        capacityBound: capacityFlags[idx],
        priceRisk: unitCosts[idx] > ensurePositive(team.price, refPrice),
        negativeProfit: profitRaw <= 0,
      },
    };
  });

  const damped = windfallDamping(results.map((r) => r.profitRaw), season.dampingAlpha ?? 0);
  const reinvestRate = season.rules.reinvestRate;
  const finalResults = results.map((result, idx) => {
    const profit = damped[idx];
    const split = splitProfit(profit, reinvestRate);
    return {
      ...result,
      profit,
      reinvest: split.reinvest,
      cashToFinal: split.cashToFinal,
      flags: {
        ...result.flags,
        negativeProfit: profit <= 0,
      },
    };
  });

  finalResults.sort((a, b) => b.profit - a.profit);

  const totals = finalResults.reduce(
    (acc, result) => {
      acc.totalShare += result.share;
      acc.totalDemand += result.demandRaw;
      acc.totalSales += result.sales;
      acc.totalRevenue += result.revenue;
      acc.totalProfit += result.profit;
      return acc;
    },
    {
      marketSize,
      totalShare: 0,
      totalDemand: 0,
      totalSales: 0,
      totalRevenue: 0,
      totalProfit: 0,
    }
  );

  return {
    season,
    round,
    results: finalResults,
    totals,
  };
};

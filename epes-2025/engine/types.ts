export interface WeightVector {
  price: number;
  quality: number;
  marketing: number;
  cx: number;
}

export interface SeasonCosts {
  cvuBase: number;
  kQuality: number;
  kEfficiency: number;
  fixedTeamCost: number;
  benefitCost?: number;
}

export interface SeasonRules {
  reinvestRate: number;
}

export interface SeasonParams {
  refPrice: number;
  softmaxBeta: number;
  shareCap?: number | null;
  noiseStd?: number | null;
  dampingAlpha?: number | null;
  weights: WeightVector;
  costs: SeasonCosts;
  rules: SeasonRules;
}

export interface PublicTarget {
  id: string;
  deltas: Partial<WeightVector>;
  elasticity: number;
  marketingBoost?: number;
}

export interface TeamDecision {
  teamId: string;
  name: string;
  publicTargetId: string;
  price: number;
  marketingSpend: number;
  capacity: number;
  quality: number;
  efficiency: number;
  cx: number;
  launchEA: number;
  brandEA: number;
  benefitChoice?: string | null;
  benefitCostOverride?: number | null;
  reinvestBudget: number;
  cash: number;
}

export interface RoundInfo {
  marketSize: number;
  roundId: string;
}

export interface ComputeRoundInput {
  season: SeasonParams;
  publicTargets: PublicTarget[];
  teams: TeamDecision[];
  round: RoundInfo;
}

export interface TeamRoundResult {
  teamId: string;
  name: string;
  publicTargetId: string;
  eaLinear: number;
  ea: number;
  share: number;
  demandRaw: number;
  capacity: number;
  sales: number;
  revenue: number;
  unitCost: number;
  variableCost: number;
  marketingCost: number;
  fixedCost: number;
  benefitCost: number;
  profitRaw: number;
  profit: number;
  reinvest: number;
  cashToFinal: number;
  price: number;
  marketingSpend: number;
  flags: {
    capacityBound: boolean;
    priceRisk: boolean;
    negativeProfit: boolean;
  };
}

export interface ComputeRoundOutput {
  season: SeasonParams;
  round: RoundInfo;
  results: TeamRoundResult[];
  totals: {
    marketSize: number;
    totalShare: number;
    totalDemand: number;
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;
  };
}

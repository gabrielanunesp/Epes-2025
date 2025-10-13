import { clamp, computeEA, demandRaw, marketingScore, priceScore, softmax, capShares, splitProfit, tunedWeights, unitCost, windfallDamping } from './math.js';
import type { ComputeRoundInput, ComputeRoundOutput } from './types.js';
export { clamp, computeEA, demandRaw, marketingScore, priceScore, softmax, capShares, splitProfit, tunedWeights, unitCost, windfallDamping, };
export declare const computeRound: (input: ComputeRoundInput) => ComputeRoundOutput;

import type { PublicTarget, SeasonParams, TeamDecision, WeightVector } from './types.js';
export declare const clamp: (value: number, min: number, max: number) => number;
export declare const priceScore: (price: number, refPrice: number) => number;
export declare const marketingScore: (spend: number, boost?: number) => number;
export declare const tunedWeights: (base: WeightVector, target?: PublicTarget | null) => {
    price: number;
    quality: number;
    marketing: number;
    cx: number;
};
export declare const computeEA: (weights: WeightVector, team: TeamDecision, refPrice: number, publicTarget?: PublicTarget | null) => {
    eaLinear: number;
    ea: number;
    components: {
        priceComponent: number;
        qualityComponent: number;
        marketingComponent: number;
        cxComponent: number;
    };
};
export declare const softmax: (values: number[], beta: number) => number[];
export declare const capShares: (shares: number[], cap?: number | null) => number[];
export declare const demandRaw: (marketSize: number, share: number, price: number, refPrice: number, elasticity: number) => number;
export declare const unitCost: (team: TeamDecision, season: SeasonParams) => number;
export declare const windfallDamping: (profits: number[], alpha?: number | null) => number[];
export declare const splitProfit: (profit: number, reinvestRate: number) => {
    reinvest: number;
    cashToFinal: number;
};

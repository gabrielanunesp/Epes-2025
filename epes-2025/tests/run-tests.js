#!/usr/bin/env node
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build', 'engine');

console.log('Compiling engine...');
execSync(`npx tsc -p ${path.join(projectRoot, 'tsconfig.engine.json')}`, { stdio: 'inherit' });

const engineUrl = pathToFileURL(path.join(buildDir, 'index.js')).href;
const engine = await import(engineUrl);

const tests = [];
const test = (name, fn) => {
  tests.push({ name, fn });
};

const season = {
  refPrice: 50,
  softmaxBeta: 1.1,
  shareCap: 0.55,
  dampingAlpha: 1.5,
  weights: { price: 40, quality: 30, marketing: 20, cx: 10 },
  costs: { cvuBase: 12, kQuality: 8, kEfficiency: 6, fixedTeamCost: 2000, benefitCost: 500 },
  rules: { reinvestRate: 0.2 },
};

const publicTargets = [
  { id: 'CLASS_AB', deltas: { price: 5, quality: 5 }, elasticity: 0.9, marketingBoost: 0.1 },
  { id: 'CLASS_CD', deltas: { price: -5, marketing: 3 }, elasticity: 1.3, marketingBoost: 0.2 },
  { id: 'SENIOR_40P', deltas: { quality: 8, cx: 4 }, elasticity: 0.8, marketingBoost: 0 },
];

test('softmax shares respect cap and sum to 1', () => {
  const shares = engine.softmax([3, 2, 1], 1);
  const capped = engine.capShares(shares, 0.5);
  const sum = capped.reduce((acc, v) => acc + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'shares should sum to 1');
  capped.forEach((value) => assert.ok(value <= 0.5 + 1e-9, 'share above cap'));
});

test('EA and demand raw are positive', () => {
  const target = publicTargets[0];
  const weights = engine.tunedWeights(season.weights, target);
  const ea = engine.computeEA(weights, {
    teamId: 'A',
    name: 'Team A',
    publicTargetId: target.id,
    price: 55,
    marketingSpend: 15000,
    capacity: 5000,
    quality: 80,
    efficiency: 60,
    cx: 70,
    launchEA: 0.05,
    brandEA: 0.02,
    benefitChoice: null,
    benefitCostOverride: null,
    reinvestBudget: 2000,
    cash: 4000,
  }, season.refPrice, target);
  assert.ok(ea.ea > 0);
  const demand = engine.demandRaw(10000, 0.3, 55, season.refPrice, target.elasticity);
  assert.ok(demand > 0);
});

test('capacity scaling keeps sales under market size', () => {
  const round = engine.computeRound({
    season,
    publicTargets,
    round: { marketSize: 10000, roundId: 'D2' },
    teams: publicTargets.map((target, idx) => ({
      teamId: target.id,
      name: target.id,
      publicTargetId: target.id,
      price: [55, 48, 60][idx],
      marketingSpend: [15000, 18000, 12000][idx],
      capacity: 9000,
      quality: 80 + idx * 5,
      efficiency: 60 + idx * 5,
      cx: 70 + idx * 5,
      launchEA: 0,
      brandEA: 0,
      benefitChoice: null,
      benefitCostOverride: null,
      reinvestBudget: 2000,
      cash: 5000,
    })),
  });
  const totalSales = round.results.reduce((acc, r) => acc + r.sales, 0);
  assert.ok(totalSales <= 10000 + 1e-6, 'sales must not exceed market size');
});

test('split profit uses 20/80 and windfall damping is applied', () => {
  const profits = [1000, 2000, 5000];
  const damped = engine.windfallDamping(profits, 1.5);
  damped.forEach((value, idx) => {
    if (idx === 2) {
      assert.ok(value <= profits[idx], 'damped profit should not increase');
    }
  });
  const split = engine.splitProfit(1000, season.rules.reinvestRate);
  assert.equal(Math.round(split.reinvest), 200);
  assert.equal(Math.round(split.cashToFinal), 800);
  const splitNegative = engine.splitProfit(-100, season.rules.reinvestRate);
  assert.equal(splitNegative.reinvest, 0);
  assert.equal(splitNegative.cashToFinal, 0);
});

test('integration scenario enforces competition', () => {
  const round = engine.computeRound({
    season,
    publicTargets,
    round: { marketSize: 10000, roundId: 'D5' },
    teams: [
      {
        teamId: 'CLASS_AB',
        name: 'Classe AB',
        publicTargetId: 'CLASS_AB',
        price: 55,
        marketingSpend: 12000,
        capacity: 7000,
        quality: 85,
        efficiency: 70,
        cx: 75,
        launchEA: 0.1,
        brandEA: 0.05,
        benefitChoice: null,
        benefitCostOverride: null,
        reinvestBudget: 3000,
        cash: 9000,
      },
      {
        teamId: 'CLASS_CD',
        name: 'Classe CD',
        publicTargetId: 'CLASS_CD',
        price: 48,
        marketingSpend: 16000,
        capacity: 8000,
        quality: 75,
        efficiency: 60,
        cx: 65,
        launchEA: 0,
        brandEA: 0,
        benefitChoice: null,
        benefitCostOverride: null,
        reinvestBudget: 2500,
        cash: 7000,
      },
      {
        teamId: 'SENIOR_40P',
        name: 'Senior',
        publicTargetId: 'SENIOR_40P',
        price: 60,
        marketingSpend: 10000,
        capacity: 6000,
        quality: 90,
        efficiency: 80,
        cx: 80,
        launchEA: 0.05,
        brandEA: 0.05,
        benefitChoice: null,
        benefitCostOverride: null,
        reinvestBudget: 2600,
        cash: 8000,
      },
    ],
  });
  const shareSum = round.results.reduce((acc, r) => acc + r.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9, 'shares must sum to 1');
  const altered = engine.computeRound({
    season,
    publicTargets,
    round: { marketSize: 10000, roundId: 'D5' },
    teams: [
      {
        ...round.results.find((r) => r.teamId === 'CLASS_AB'),
        price: 45,
      },
      {
        ...round.results.find((r) => r.teamId === 'CLASS_CD'),
      },
      {
        ...round.results.find((r) => r.teamId === 'SENIOR_40P'),
      },
    ].map((r) => ({
      teamId: r.teamId,
      name: r.name,
      publicTargetId: r.publicTargetId,
      price: r.price,
      marketingSpend: r.marketingSpend,
      capacity: r.capacity,
      quality: r.unitCost * 100,
      efficiency: r.unitCost * 100,
      cx: r.share * 100,
      launchEA: 0,
      brandEA: 0,
      benefitChoice: null,
      benefitCostOverride: null,
      reinvestBudget: 2000,
      cash: 5000,
    })),
  });
  const originalShare = round.results.find((r) => r.teamId === 'CLASS_CD')?.share ?? 0;
  const newShare = altered.results.find((r) => r.teamId === 'CLASS_CD')?.share ?? 0;
  assert.notEqual(originalShare, newShare, 'share should change when competitor changes price');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
} else {
  console.log(`\n${passed} tests passed.`);
}

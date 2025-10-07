#!/usr/bin/env node
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const buildPath = path.join(projectRoot, 'build', 'engine', 'index.js');

function compileEngine() {
  try {
    execSync(`npx tsc -p ${path.join(projectRoot, 'tsconfig.engine.json')} --pretty false`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to compile engine:', error.message);
    process.exit(1);
  }
}

compileEngine();
const engine = await import(pathToFileURL(buildPath).href);
const { computeRound } = engine;

const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
};

function send(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...corsHeaders,
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const data = raw ? JSON.parse(raw) : {};
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function validateComputePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Body must be an object');
  }
  const { season, publicTargets, teams, round } = payload;
  if (!season || typeof season !== 'object') throw new Error('season is required');
  if (!Array.isArray(publicTargets)) throw new Error('publicTargets must be an array');
  if (!Array.isArray(teams)) throw new Error('teams must be an array');
  if (!round || typeof round !== 'object') throw new Error('round is required');
  return { season, publicTargets, teams, round };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname === '/v1/compute') {
    try {
      const payload = await parseBody(req);
      const input = validateComputePayload(payload);
      const result = computeRound(input);
      send(res, 200, result);
    } catch (error) {
      console.error('Compute error', error);
      send(res, 400, { error: error.message ?? 'Invalid payload' });
    }
    return;
  }

  if (url.pathname === '/v1/close-round') {
    try {
      const idempotencyKey = req.headers['idempotency-key'];
      const payload = await parseBody(req);
      const input = validateComputePayload(payload);
      const result = computeRound(input);
      const totals = {
        roundId: input.round.roundId,
        idempotencyKey: idempotencyKey ?? null,
        generatedAt: new Date().toISOString(),
        totals: result.totals,
        distribution: result.results.map((r) => ({
          teamId: r.teamId,
          profit: r.profit,
          reinvest: r.reinvest,
          cashToFinal: r.cashToFinal,
        })),
      };
      send(res, 200, totals);
    } catch (error) {
      console.error('Close round error', error);
      send(res, 400, { error: error.message ?? 'Invalid payload' });
    }
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`EPES engine API listening on port ${port}`);
});

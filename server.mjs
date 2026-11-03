import { timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { CloneEngine } from './lib/engine.mjs';
import { TradeExecutor } from './lib/executor.mjs';
import { JupiterSwap } from './lib/jupiter.mjs';
import { JupiterTokens } from './lib/tokens.mjs';
import { RiskPolicy } from './lib/risk.mjs';
import { DiscoveryStrategy } from './lib/strategy.mjs';
import { SolanaRpc } from './lib/solana.mjs';
import { JsonStore } from './lib/store.mjs';
import { TreasuryService } from './lib/treasury.mjs';
import { deriveCloneKeypair } from './lib/wallets.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const config = await loadConfig(root);
const store = new JsonStore(config.dataFile, config);
const rpc = new SolanaRpc(config.rpcUrl);
const streams = new Set();
const broadcast = (event, value) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
  for (const response of streams) response.write(message);
};
const engine = new CloneEngine(store, config, (state, result) => {
  broadcast('state', state);
  for (const clone of result.spawned || []) broadcast('agent', clone);
});
const executor = new TradeExecutor({
  config,
  jupiter: new JupiterSwap(config.jupiterApiKey),
  risk: new RiskPolicy(config),
});
const treasuryService = new TreasuryService(config);
const tokenDiscovery = new JupiterTokens(config.jupiterApiKey);
const discoveryStrategy = new DiscoveryStrategy(config);

await store.load();
if (config.masterSeed) {
  await store.transact(async (state) => {
    for (const clone of state.clones) {
      if (!clone.address) clone.address = (await deriveCloneKeypair(config.masterSeed, clone.id)).publicKey.toBase58();
    }
  });
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, value, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

function authorized(req) {
  if (!config.adminToken) return false;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const left = Buffer.from(supplied);
  const right = Buffer.from(config.adminToken);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64 * 1024) throw new Error('Request body too large');
  }
  return body ? JSON.parse(body) : {};
}

async function syncTreasury() {
  if (!config.treasuryAddress) return { configured: false, reason: 'CLONES_TREASURY_ADDRESS is not set' };
  try {
    const balance = await rpc.getBalance(config.treasuryAddress);
    let feeEvent = null;
    const output = await store.transact((state) => {
      const previous = state.chain.lastObservedLamports;
      state.chain.status = 'online';
      state.chain.error = null;
      state.chain.slot = balance.context.slot;
      state.chain.treasuryLamports = balance.value;
      state.chain.lastObservedLamports = balance.value;
      state.chain.lastSyncAt = new Date().toISOString();
      if (config.autoCountDeposits && previous != null && balance.value > previous && config.solUsdPrice > 0) {
        const lamports = balance.value - previous;
        feeEvent = {
          id: `rpc:${balance.context.slot}:${balance.value}`,
          amountUsd: (lamports / 1_000_000_000) * config.solUsdPrice,
          source: 'dedicated-treasury-rpc',
        };
      }
    });
    broadcast('state', output.state);
    if (feeEvent) await engine.recordFee(feeEvent);
    return { configured: true, slot: balance.context.slot, lamports: balance.value, feeEvent };
  } catch (error) {
    const output = await store.transact((state) => {
      state.chain.status = 'error';
      state.chain.error = error.message;
      state.chain.lastSyncAt = new Date().toISOString();
    });
    broadcast('state', output.state);
    throw error;
  }
}

async function activateClone(cloneId) {
  if (!config.tokenMint) throw new Error('CLONES_TOKEN_MINT is required');
  if (!config.liveTrading) throw new Error('CLONES_LIVE_TRADING is disabled');
  let clone = store.view().clones.find((item) => item.id === cloneId);
  if (!clone) throw new Error('Clone not found');
  if (clone.status === 'active') return { status: 'already_active', clone };

  let funding = clone.funding || null;
  if (!funding?.signature) {
    funding = await treasuryService.fundClone(cloneId);
    await store.transact((state) => {
      const item = state.clones.find((entry) => entry.id === cloneId);
      item.address = funding.clone;
      item.funding = funding;
      item.status = 'funded';
      item.note = 'Funding confirmed. Preparing the permanent CLONES allocation.';
    });
  }

  const buyLamports = Math.floor((config.clonesBuyUsd / config.solUsdPrice) * 1_000_000_000);
  try {
    const trade = await executor.swap(cloneId, {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: config.tokenMint,
      amount: String(buyLamports),
      expectedUsd: config.clonesBuyUsd,
      symbol: 'CLONES',
      reason: 'Permanent initial CLONES allocation for a newly funded Clone',
    });
    const output = await store.transact((state) => {
      const item = state.clones.find((entry) => entry.id === cloneId);
      item.status = 'active';
      item.trading = 'active';
      item.bankUsd = config.tradingBankUsd;
      item.clonesUsd = config.clonesBuyUsd;
      item.activationSignature = trade.execution?.signature || null;
      item.note = 'Active. Permanent CLONES allocation confirmed; trading bank is ready.';
      state.trades.unshift({
        id: trade.execution?.signature || `activation:${trade.summary.requestId}`,
        agentId: cloneId,
        side: 'buy', symbol: 'CLONES', usd: config.clonesBuyUsd,
        status: trade.status, signature: trade.execution?.signature || null,
        reason: trade.summary.reason, createdAt: new Date().toISOString(),
      });
    });
    broadcast('state', output.state);
    clone = output.state.clones.find((item) => item.id === cloneId);
    return { status: 'active', funding, trade, clone };
  } catch (error) {
    await store.transact((state) => {
      const item = state.clones.find((entry) => entry.id === cloneId);
      item.status = 'activation_error';
      item.trading = 'locked';
      item.note = `Funds are on the Clone wallet; allocation retry required: ${error.message}`;
    });
    throw error;
  }
}

async function runDiscovery({ execute = false } = {}) {
  const tokens = await tokenDiscovery.topOrganic('5m', 50);
  const ranked = discoveryStrategy.rank(tokens).slice(0, 10);
  const output = await store.transact((state) => {
    state.callouts = ranked.map((candidate) => ({
      id: `discovery:${candidate.mint}`,
      agentId: null,
      type: 'market_candidate',
      status: 'observed',
      ...candidate,
    }));
    state.discovery = {
      status: 'online',
      source: 'Jupiter Tokens V2 top organic score',
      observed: tokens.length,
      eligible: ranked.length,
      lastScanAt: new Date().toISOString(),
      error: null,
    };
  });
  broadcast('state', output.state);

  let trade = null;
  if (execute && config.autoTrade) {
    if (!config.liveTrading) throw new Error('CLONES_LIVE_TRADING is disabled');
    if (!config.tokenMint) throw new Error('CLONES_TOKEN_MINT is required');
    if (!(config.solUsdPrice > 0)) throw new Error('CLONES_SOL_USD_PRICE is required');
    const state = store.view();
    const clone = state.clones.find((item) => item.status === 'active' && item.bankUsd >= config.strategyTradeUsd);
    const tradedMints = new Set(state.trades.map((item) => item.outputMint).filter(Boolean));
    const candidate = ranked.find((item) => !tradedMints.has(item.mint));
    if (clone && candidate) {
      const lamports = Math.floor((config.strategyTradeUsd / config.solUsdPrice) * 1_000_000_000);
      trade = await executor.swap(clone.id, {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: candidate.mint,
        amount: String(lamports),
        expectedUsd: config.strategyTradeUsd,
        symbol: candidate.symbol,
        reason: `Risk-qualified discovery: organic ${candidate.organicScore}, liquidity $${Math.round(candidate.liquidityUsd)}, score ${candidate.score}`,
      });
      const saved = await store.transact((draft) => {
        const item = draft.clones.find((entry) => entry.id === clone.id);
        item.bankUsd = Math.max(0, Math.round((item.bankUsd - config.strategyTradeUsd) * 100) / 100);
        item.trades += 1;
        item.openPositions += 1;
        draft.trades.unshift({
          id: trade.execution?.signature || `strategy:${trade.summary.requestId}`,
          agentId: clone.id,
          side: 'buy',
          symbol: candidate.symbol,
          outputMint: candidate.mint,
          usd: config.strategyTradeUsd,
          status: trade.status,
          signature: trade.execution?.signature || null,
          reason: trade.summary.reason,
          createdAt: new Date().toISOString(),
        });
      });
      broadcast('state', saved.state);
    }
  }
  return { observed: tokens.length, eligible: ranked.length, candidates: ranked, trade };
}

async function serveApi(url, req, res) {
  const state = store.view();
  const clones = state.clones;
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, {
      ok: true,
      mode: state.mode,
      chain: state.chain.status,
      persistence: true,
      configured: {
        tokenMint: Boolean(config.tokenMint),
        treasury: Boolean(config.treasuryAddress),
        admin: Boolean(config.adminToken),
        signer: executor.readiness().signer,
        jupiter: executor.readiness().jupiter,
        liveTrading: executor.readiness().liveTrading,
        autoActivate: config.autoActivate,
        autoDiscovery: config.autoDiscovery,
        autoTrade: config.autoTrade,
        treasurySigner: await treasuryService.address(),
      },
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') return sendJson(res, state);
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') return sendJson(res, { agents: clones });
  if (req.method === 'GET' && ['/api/agents', '/api/clones'].includes(url.pathname)) return sendJson(res, { agents: clones, clones, total: clones.length });
  if (req.method === 'GET' && url.pathname === '/api/trades') return sendJson(res, { trades: state.trades });
  if (req.method === 'GET' && url.pathname === '/api/callouts') return sendJson(res, { callouts: state.callouts });
  if (req.method === 'GET' && url.pathname === '/api/holders') return sendJson(res, { rows: [], total: 0, count: 0, agentsHolding: 0 });
  if (req.method === 'GET' && /^\/api\/(agent|clone)\/\d+$/.test(url.pathname)) {
    const id = Number(url.pathname.split('/').pop());
    const clone = clones.find((item) => item.id === id);
    return clone
      ? sendJson(res, { agent: clone, clone, cashUsd: clone.bankUsd, positions: [], trades: [], callouts: [] })
      : sendJson(res, { error: 'Clone not found' }, 404);
  }
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    streams.add(res);
    res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);
    req.on('close', () => { clearInterval(heartbeat); streams.delete(res); });
    return;
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!authorized(req)) return sendJson(res, { error: config.adminToken ? 'Unauthorized' : 'Admin API is not configured' }, config.adminToken ? 401 : 503);
    if (req.method === 'POST' && url.pathname === '/api/admin/fee-events') {
      try {
        const output = await engine.recordFee(await readJson(req));
        return sendJson(res, output, output.result.duplicate ? 200 : 201);
      } catch (error) {
        return sendJson(res, { error: error.message }, 400);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/sync') {
      try {
        return sendJson(res, await syncTreasury());
      } catch (error) {
        return sendJson(res, { error: error.message }, 502);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/discovery/scan') {
      try {
        const payload = await readJson(req);
        return sendJson(res, await runDiscovery({ execute: payload.execute === true }), 200);
      } catch (error) {
        return sendJson(res, { error: error.message }, 502);
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/trades/execute') {
      if (!config.tokenMint) return sendJson(res, { error: 'CLONES_TOKEN_MINT is required before trading can be activated' }, 409);
      try {
        const payload = await readJson(req);
        const cloneId = Number(payload.cloneId);
        const clone = store.view().clones.find((item) => item.id === cloneId);
        if (!clone) return sendJson(res, { error: 'Clone not found' }, 404);
        const result = await executor.swap(cloneId, payload.intent || {});
        const output = await store.transact((state) => {
          state.trades.unshift({
            id: result.execution?.signature || `proposal:${result.summary.requestId}`,
            agentId: cloneId,
            side: payload.intent.inputMint === config.tokenMint ? 'sell' : 'buy',
            symbol: payload.intent.symbol || payload.intent.outputMint,
            usd: Number(payload.intent.expectedUsd),
            status: result.status,
            signature: result.execution?.signature || null,
            reason: payload.intent.reason,
            createdAt: new Date().toISOString(),
          });
        });
        broadcast('state', output.state);
        return sendJson(res, result, result.status === 'submitted' ? 201 : 202);
      } catch (error) {
        return sendJson(res, { error: error.message }, 400);
      }
    }
    if (req.method === 'POST' && /^\/api\/admin\/clones\/\d+\/activate$/.test(url.pathname)) {
      try {
        const cloneId = Number(url.pathname.split('/')[4]);
        return sendJson(res, await activateClone(cloneId), 201);
      } catch (error) {
        return sendJson(res, { error: error.message }, 409);
      }
    }
  }

  sendJson(res, { error: 'Not found' }, 404);
}

function serveFile(res, file) {
  res.writeHead(200, {
    'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(origin && config.allowedOrigins.includes(origin) ? 204 : 403);
      return res.end();
    }
    if (url.pathname.startsWith('/api/')) return await serveApi(url, req, res);
    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const safePath = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, '');
    const file = join(root, safePath);
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) return serveFile(res, file);
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    sendJson(res, { error: 'Internal server error' }, 500);
    console.error(error);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`CLONES runtime: http://${config.host}:${config.port}`);
  console.log(`mode=${store.view().mode} chain=${store.view().chain.status} persistence=${config.dataFile}`);
});

if (config.treasuryAddress) {
  syncTreasury().catch((error) => console.error(`Treasury sync failed: ${error.message}`));
  setInterval(() => syncTreasury().catch((error) => console.error(`Treasury sync failed: ${error.message}`)), config.pollMs).unref();
}

if (config.autoActivate && config.liveTrading) {
  let running = false;
  const drain = async () => {
    if (running) return;
    running = true;
    try {
      const pending = store.view().clones.find((item) => ['funding_pending', 'activation_error'].includes(item.status));
      if (pending) await activateClone(pending.id);
    } catch (error) {
      console.error(`Clone activation failed: ${error.message}`);
    } finally {
      running = false;
    }
  };
  setInterval(drain, config.pollMs).unref();
  drain();
}

if (config.autoDiscovery) {
  const scan = async () => {
    try {
      await runDiscovery({ execute: config.autoTrade });
    } catch (error) {
      console.error(`Token discovery failed: ${error.message}`);
      const output = await store.transact((state) => {
        state.discovery = {
          ...(state.discovery || {}), status: 'error', error: error.message,
          lastScanAt: new Date().toISOString(),
        };
      });
      broadcast('state', output.state);
    }
  };
  setInterval(scan, config.discoveryMs).unref();
  scan();
}

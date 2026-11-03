import { timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { CloneEngine } from './lib/engine.mjs';
import { SolanaRpc } from './lib/solana.mjs';
import { JsonStore } from './lib/store.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const config = loadConfig(root);
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

await store.load();

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
        signer: false,
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

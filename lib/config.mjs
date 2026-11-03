import { resolve } from 'node:path';

const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const bool = (name, fallback = false) => {
  const value = process.env[name];
  if (value == null) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

export function loadConfig(root) {
  return Object.freeze({
    host: process.env.HOST || '127.0.0.1',
    port: number('PORT', 4319),
    dataFile: resolve(process.env.CLONES_DATA_FILE || resolve(root, 'data', 'state.json')),
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet.solana.com',
    treasuryAddress: process.env.CLONES_TREASURY_ADDRESS || '',
    tokenMint: process.env.CLONES_TOKEN_MINT || '',
    adminToken: process.env.CLONES_ADMIN_TOKEN || '',
    solUsdPrice: number('CLONES_SOL_USD_PRICE', 0),
    pollMs: Math.max(10_000, number('CLONES_POLL_MS', 30_000)),
    autoCountDeposits: bool('CLONES_AUTO_COUNT_DEPOSITS', false),
    teamPct: Math.min(100, Math.max(0, number('CLONES_TEAM_PCT', 10))),
    cloneBudgetUsd: Math.max(1, number('CLONES_CLONE_BUDGET_USD', 10)),
    clonesBuyUsd: Math.max(0, number('CLONES_BUY_USD', 5)),
    tradingBankUsd: Math.max(0, number('CLONES_BANK_USD', 5)),
  });
}

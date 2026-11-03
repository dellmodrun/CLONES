import { resolve } from 'node:path';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveTreasuryKeypair, generateMasterSeed, importTreasuryKeypair } from './wallets.mjs';

const number = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const bool = (name, fallback = false) => {
  const value = process.env[name];
  if (value == null) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

export async function loadConfig(root) {
  const dataFile = resolve(process.env.CLONES_DATA_FILE || resolve(root, 'data', 'state.json'));
  let masterSeed = process.env.CLONES_MASTER_SEED || '';
  if (!masterSeed && bool('CLONES_AUTO_CREATE_SEED', false)) {
    const seedFile = join(dirname(dataFile), 'master-seed');
    try {
      masterSeed = (await readFile(seedFile, 'utf8')).trim();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      masterSeed = generateMasterSeed();
      await mkdir(dirname(seedFile), { recursive: true });
      await writeFile(seedFile, `${masterSeed}\n`, { mode: 0o600, flag: 'wx' });
    }
  }
  const treasurySecret = process.env.CLONES_TREASURY_SECRET || '';
  const derivedTreasury = treasurySecret
    ? (await importTreasuryKeypair(treasurySecret)).publicKey.toBase58()
    : masterSeed ? (await deriveTreasuryKeypair(masterSeed)).publicKey.toBase58() : '';
  const configuredTreasury = process.env.CLONES_TREASURY_ADDRESS || '';
  if (configuredTreasury && derivedTreasury && configuredTreasury !== derivedTreasury) {
    throw new Error('CLONES_TREASURY_ADDRESS does not match the master-seed treasury signer');
  }
  return Object.freeze({
    host: process.env.HOST || '127.0.0.1',
    port: number('PORT', 4319),
    dataFile,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet.solana.com',
    treasuryAddress: configuredTreasury || derivedTreasury,
    tokenMint: process.env.CLONES_TOKEN_MINT || 'NRWU4Ritj1x6jcNbpuyfoX76D7BQ8c6RfjjLoBkpump',
    tokenDecimals: Math.max(0, Math.min(18, number('CLONES_TOKEN_DECIMALS', 6))),
    xUrl: process.env.CLONES_X_URL || 'https://x.com/clonesonchain',
    adminToken: process.env.CLONES_ADMIN_TOKEN || '',
    masterSeed,
    treasurySecret,
    jupiterApiKey: process.env.JUPITER_API_KEY || '',
    liveTrading: bool('CLONES_LIVE_TRADING', false),
    autoActivate: bool('CLONES_AUTO_ACTIVATE', false),
    autoDiscovery: bool('CLONES_AUTO_DISCOVERY', true),
    autoTrade: bool('CLONES_AUTO_TRADE', false),
    discoveryMs: Math.max(60_000, number('CLONES_DISCOVERY_MS', 300_000)),
    strategyTradeUsd: Math.max(1, number('CLONES_STRATEGY_TRADE_USD', 2)),
    minLiquidityUsd: Math.max(1_000, number('CLONES_MIN_LIQUIDITY_USD', 50_000)),
    minOrganicScore: Math.min(100, Math.max(0, number('CLONES_MIN_ORGANIC_SCORE', 70))),
    minHolderCount: Math.max(10, number('CLONES_MIN_HOLDER_COUNT', 500)),
    minOrganicBuyers: Math.max(1, number('CLONES_MIN_ORGANIC_BUYERS', 20)),
    maxTopHoldersPct: Math.min(100, Math.max(1, number('CLONES_MAX_TOP_HOLDERS_PCT', 25))),
    fundingReserveSol: Math.max(0.002, number('CLONES_FUNDING_RESERVE_SOL', 0.01)),
    maxTradeUsd: Math.max(1, number('CLONES_MAX_TRADE_USD', 5)),
    maxSlippageBps: Math.min(500, Math.max(1, number('CLONES_MAX_SLIPPAGE_BPS', 150))),
    maxPriceImpactPct: Math.min(25, Math.max(0.01, number('CLONES_MAX_PRICE_IMPACT_PCT', 3))),
    solUsdPrice: number('CLONES_SOL_USD_PRICE', 0),
    pollMs: Math.max(10_000, number('CLONES_POLL_MS', 30_000)),
    autoCountDeposits: bool('CLONES_AUTO_COUNT_DEPOSITS', false),
    teamPct: Math.min(100, Math.max(0, number('CLONES_TEAM_PCT', 10))),
    cloneBudgetUsd: Math.max(1, number('CLONES_CLONE_BUDGET_USD', 10)),
    clonesBuyUsd: Math.max(0, number('CLONES_BUY_USD', 5)),
    tradingBankUsd: Math.max(0, number('CLONES_BANK_USD', 5)),
    allowedOrigins: (process.env.CLONES_ALLOWED_ORIGINS || 'https://dellmodrun.github.io,http://127.0.0.1:4319,http://localhost:4319')
      .split(',').map((value) => value.trim()).filter(Boolean),
  });
}

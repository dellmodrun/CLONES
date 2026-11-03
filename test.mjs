import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CloneEngine } from './lib/engine.mjs';
import { TradeExecutor } from './lib/executor.mjs';
import { RiskPolicy } from './lib/risk.mjs';
import { DiscoveryStrategy } from './lib/strategy.mjs';
import { JsonStore } from './lib/store.mjs';
import { deriveCloneKeypair, deriveTreasuryKeypair, generateMasterSeed } from './lib/wallets.mjs';

const directory = await mkdtemp(join(tmpdir(), 'clones-test-'));
const config = {
  dataFile: join(directory, 'state.json'), tokenMint: '', treasuryAddress: '', teamPct: 10,
  cloneBudgetUsd: 10, clonesBuyUsd: 5, tradingBankUsd: 5,
};

try {
  const store = new JsonStore(config.dataFile, config);
  await store.load();
  const engine = new CloneEngine(store, config);
  const first = await engine.recordFee({ id: 'fee-1', amountUsd: 22.23, source: 'test' });
  assert.equal(first.result.spawned.length, 2);
  assert.equal(first.state.clones.length, 3);
  assert.equal(first.state.clones[1].pumpName, 'clone_0002');
  assert.equal(first.state.fees.spentUsd, 20);
  const duplicate = await engine.recordFee({ id: 'fee-1', amountUsd: 22.23, source: 'test' });
  assert.equal(duplicate.result.duplicate, true);
  assert.equal(duplicate.state.clones.length, 3);
  const persisted = JSON.parse(await readFile(config.dataFile, 'utf8'));
  assert.equal(persisted.feeEvents.length, 1);

  const masterSeed = generateMasterSeed();
  assert.equal(
    (await deriveCloneKeypair(masterSeed, 7)).publicKey.toBase58(),
    (await deriveCloneKeypair(masterSeed, 7)).publicKey.toBase58(),
  );
  assert.notEqual(
    (await deriveCloneKeypair(masterSeed, 7)).publicKey.toBase58(),
    (await deriveCloneKeypair(masterSeed, 8)).publicKey.toBase58(),
  );
  assert.notEqual(
    (await deriveTreasuryKeypair(masterSeed)).publicKey.toBase58(),
    (await deriveCloneKeypair(masterSeed, 1)).publicKey.toBase58(),
  );

  const wrappedSol = 'So11111111111111111111111111111111111111112';
  const officialMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const tradeConfig = {
    masterSeed, tokenMint: officialMint, liveTrading: false,
    maxTradeUsd: 5, maxSlippageBps: 150, maxPriceImpactPct: 3,
  };
  const risk = new RiskPolicy(tradeConfig);
  assert.throws(() => risk.validateIntent({
    inputMint: officialMint, outputMint: wrappedSol, amount: '1000', expectedUsd: 1,
    reason: 'attempt to sell official holdings',
  }), /forbidden/);
  const jupiter = {
    order: async () => ({
      transaction: 'not-signed-in-approval-mode', requestId: 'request-1', inAmount: '1000', outAmount: '900',
      priceImpactPct: '0.001', slippageBps: 100, router: 'test-router',
    }),
  };
  const executor = new TradeExecutor({ config: tradeConfig, jupiter, risk });
  const proposal = await executor.swap(2, {
    inputMint: wrappedSol, outputMint: officialMint, amount: '1000', expectedUsd: 5,
    reason: 'initial capped CLONES allocation',
  });
  assert.equal(proposal.status, 'approval_required');
  assert.equal(proposal.summary.cloneId, 2);
  assert.ok(proposal.summary.wallet);
  const strategy = new DiscoveryStrategy({
    tokenMint: officialMint, minLiquidityUsd: 50_000, minOrganicScore: 70,
    minHolderCount: 500, minOrganicBuyers: 20, maxTopHoldersPct: 25,
  });
  const candidates = strategy.rank([{
    id: '9xQeWvG816bUx9EPfEZy8SKXKzQj9k1wFTu6bQp6pump', symbol: 'SAFE', name: 'Safe candidate',
    liquidity: 100_000, organicScore: 82, holderCount: 1200,
    audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 18 },
    stats5m: { numOrganicBuyers: 45 },
  }, {
    id: 'BadMint1111111111111111111111111111111111111', symbol: 'BAD', liquidity: 5_000,
    organicScore: 10, holderCount: 20, audit: {}, stats5m: { numOrganicBuyers: 1 },
  }]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].symbol, 'SAFE');
  assert.equal(strategy.evaluate({
    id: wrappedSol, symbol: 'SOL', liquidity: 1_000_000, organicScore: 99, holderCount: 1_000_000,
    audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 1 },
    stats5m: { numOrganicBuyers: 1000 },
  }).eligible, false);
  console.log('PASS: persistence, idempotency, Clone spawning, wallets, risk, discovery strategy, dry-run execution');
} finally {
  await rm(directory, { recursive: true, force: true });
}

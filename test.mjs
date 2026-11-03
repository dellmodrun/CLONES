import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CloneEngine } from './lib/engine.mjs';
import { JsonStore } from './lib/store.mjs';

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
  console.log('PASS: durable fees, idempotency, Clone spawning, allocation accounting');
} finally {
  await rm(directory, { recursive: true, force: true });
}

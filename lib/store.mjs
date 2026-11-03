import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const now = () => new Date().toISOString();

export function createInitialState(config) {
  const clone = {
    id: 1,
    pumpName: 'clone_0001',
    style: 'Genesis',
    status: 'waiting',
    trading: 'waiting',
    avatarUrl: '/clones.png',
    address: null,
    bankStartUsd: 0,
    bankUsd: 0,
    pnlUsd: null,
    clonesUsd: 0,
    trades: 0,
    wins: 0,
    openPositions: 0,
    note: 'Waiting for the CLONES token launch on Solana via Pump.fun.',
    createdAt: now(),
  };
  return {
    version: 1,
    mode: config.tokenMint ? 'configured' : 'prelaunch',
    network: 'Solana mainnet',
    ticker: 'CLONES',
    ca: config.tokenMint || 'TBA',
    xUrl: '#',
    pumpUrl: config.tokenMint ? `https://pump.fun/coin/${config.tokenMint}` : 'https://pump.fun/',
    teamPct: config.teamPct,
    agentUsd: config.cloneBudgetUsd,
    clonesBuyUsd: config.clonesBuyUsd,
    bankUsd: config.tradingBankUsd,
    sweepUsd: config.cloneBudgetUsd,
    updatedAt: now(),
    token: { marketCap: null },
    clones: [clone],
    trades: [],
    callouts: [],
    feeEvents: [],
    fees: { claimedUsd: 0, unclaimedUsd: 0, spentUsd: 0, teamUsd: 0, claims: [] },
    chain: {
      status: config.treasuryAddress ? 'waiting' : 'unconfigured',
      treasuryAddress: config.treasuryAddress || null,
      treasuryLamports: null,
      lastObservedLamports: null,
      slot: null,
      lastSyncAt: null,
      error: null,
    },
  };
}

function cloneSummary(state, config) {
  const clones = state.clones;
  const active = clones.filter((item) => item.status === 'active').length;
  const stopped = clones.filter((item) => item.status === 'stopped').length;
  const available = Math.max(0, state.fees.claimedUsd - state.fees.teamUsd - state.fees.spentUsd);
  const nextNumber = clones.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  return {
    ...state,
    agents: {
      total: clones.length,
      active,
      stopped,
      bankUsd: clones.reduce((sum, item) => sum + Number(item.bankUsd || 0), 0),
      investedUsd: clones.reduce((sum, item) => sum + Number(item.clonesUsd || 0), 0),
      profitToClonesUsd: 0,
      trades: state.trades.length,
      wins: clones.reduce((sum, item) => sum + Number(item.wins || 0), 0),
      calloutsPosted: state.callouts.filter((item) => item.status === 'posted').length,
      calloutsQueued: state.callouts.filter((item) => item.status !== 'posted').length,
      heldPct: null,
    },
    next: {
      number: nextNumber,
      agent: null,
      haveUsd: available,
      needUsd: config.cloneBudgetUsd,
      ready: Math.min(1, available / config.cloneBudgetUsd),
    },
    treasury: state.chain.treasuryAddress,
  };
}

export class JsonStore {
  constructor(file, config) {
    this.file = file;
    this.config = config;
    this.state = createInitialState(config);
    this.queue = Promise.resolve();
  }

  async load() {
    try {
      this.state = { ...this.state, ...JSON.parse(await readFile(this.file, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    return this.view();
  }

  view() {
    return cloneSummary(structuredClone(this.state), this.config);
  }

  async transact(mutator) {
    const task = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await mutator(draft);
      draft.updatedAt = now();
      this.state = draft;
      await this.persist();
      return { state: this.view(), result };
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async persist() {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }
}

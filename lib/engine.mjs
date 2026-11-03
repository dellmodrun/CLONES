import { deriveCloneKeypair } from './wallets.mjs';

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export class CloneEngine {
  constructor(store, config, onChange = () => {}) {
    this.store = store;
    this.config = config;
    this.onChange = onChange;
  }

  async recordFee(event) {
    if (!event?.id || !Number.isFinite(Number(event.amountUsd)) || Number(event.amountUsd) <= 0) {
      throw new Error('A unique id and positive amountUsd are required');
    }
    const output = await this.store.transact(async (state) => {
      if (state.feeEvents.some((item) => item.id === event.id)) return { duplicate: true, spawned: [] };
      const gross = round(event.amountUsd);
      const team = round(gross * (this.config.teamPct / 100));
      state.feeEvents.push({
        id: String(event.id),
        amountUsd: gross,
        source: event.source || 'verified',
        signature: event.signature || null,
        observedAt: event.observedAt || new Date().toISOString(),
      });
      state.fees.claimedUsd = round(state.fees.claimedUsd + gross);
      state.fees.teamUsd = round(state.fees.teamUsd + team);
      state.fees.claims.unshift({ amountUsd: gross, source: event.source || 'verified', signature: event.signature || null });

      const spawned = [];
      let available = state.fees.claimedUsd - state.fees.teamUsd - state.fees.spentUsd;
      while (available + 1e-9 >= this.config.cloneBudgetUsd) {
        const id = state.clones.reduce((max, clone) => Math.max(max, clone.id), 0) + 1;
        const derivedWallet = this.config.masterSeed ? await deriveCloneKeypair(this.config.masterSeed, id) : null;
        const clone = {
          id,
          pumpName: `clone_${String(id).padStart(4, '0')}`,
          style: 'Autonomous',
          status: 'funding_pending',
          trading: 'locked',
          avatarUrl: '/clones.png',
          address: derivedWallet ? derivedWallet.publicKey.toBase58() : null,
          bankStartUsd: this.config.tradingBankUsd,
          bankUsd: 0,
          pnlUsd: null,
          clonesUsd: 0,
          trades: 0,
          wins: 0,
          openPositions: 0,
          allocation: { clonesBuyUsd: this.config.clonesBuyUsd, tradingBankUsd: this.config.tradingBankUsd },
          note: 'Allocation verified. Waiting for the signer service to fund this Clone.',
          createdAt: new Date().toISOString(),
        };
        state.clones.push(clone);
        state.fees.spentUsd = round(state.fees.spentUsd + this.config.cloneBudgetUsd);
        available -= this.config.cloneBudgetUsd;
        spawned.push(clone);
      }
      return { duplicate: false, spawned };
    });
    this.onChange(output.state, output.result);
    return output;
  }
}

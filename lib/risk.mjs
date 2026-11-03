const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class RiskPolicy {
  constructor(config) {
    this.config = config;
  }

  validateIntent(intent) {
    if (!BASE58.test(intent.inputMint || '') || !BASE58.test(intent.outputMint || '')) throw new Error('Invalid mint address');
    if (!/^\d+$/.test(String(intent.amount || '')) || BigInt(intent.amount) <= 0n) throw new Error('Trade amount must be positive base units');
    if (!Number.isFinite(Number(intent.expectedUsd)) || Number(intent.expectedUsd) <= 0) throw new Error('expectedUsd is required');
    if (Number(intent.expectedUsd) > this.config.maxTradeUsd) throw new Error(`Trade exceeds $${this.config.maxTradeUsd} limit`);
    if (this.config.tokenMint && intent.inputMint === this.config.tokenMint) throw new Error('Selling official CLONES is forbidden');
    if (!intent.reason || String(intent.reason).length < 12) throw new Error('A concrete trade reason is required');
  }

  validateOrder(order) {
    const impact = Number(order.priceImpactPct ?? order.priceImpact ?? 0);
    if (!Number.isFinite(impact)) throw new Error('Jupiter returned invalid price impact');
    const percent = impact <= 1 ? impact * 100 : impact;
    if (percent > this.config.maxPriceImpactPct) throw new Error(`Price impact ${percent.toFixed(2)}% exceeds policy`);
    if (Number(order.slippageBps || 0) > this.config.maxSlippageBps) throw new Error('Slippage exceeds policy');
  }
}

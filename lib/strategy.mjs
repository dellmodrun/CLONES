const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const BASE_ASSETS = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYDViqR9RfYua7fAYY2mYh2W',
]);

export class DiscoveryStrategy {
  constructor(config) {
    this.config = config;
  }

  evaluate(token) {
    const audit = token.audit || {};
    const stats = token.stats5m || {};
    const reasons = [];
    if (!token.id || token.id === this.config.tokenMint || BASE_ASSETS.has(token.id)) reasons.push('invalid, base, or official mint');
    if (!audit.mintAuthorityDisabled) reasons.push('mint authority enabled');
    if (!audit.freezeAuthorityDisabled) reasons.push('freeze authority enabled');
    if (number(audit.topHoldersPercentage) > this.config.maxTopHoldersPct) reasons.push('holder concentration too high');
    if (number(token.liquidity) < this.config.minLiquidityUsd) reasons.push('liquidity below floor');
    if (number(token.organicScore) < this.config.minOrganicScore) reasons.push('organic score below floor');
    if (number(token.holderCount) < this.config.minHolderCount) reasons.push('holder count below floor');
    if (number(stats.numOrganicBuyers) < this.config.minOrganicBuyers) reasons.push('too few organic buyers');

    const score = Math.round((
      Math.min(100, number(token.organicScore)) * 0.45
      + Math.min(100, Math.log10(Math.max(1, number(token.liquidity))) * 15) * 0.25
      + Math.min(100, Math.log10(Math.max(1, number(token.holderCount))) * 20) * 0.15
      + Math.min(100, number(stats.numOrganicBuyers) * 2) * 0.15
    ) * 100) / 100;

    return {
      eligible: reasons.length === 0,
      score,
      reasons,
      mint: token.id,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown token',
      icon: token.icon || null,
      liquidityUsd: number(token.liquidity),
      organicScore: number(token.organicScore),
      holderCount: number(token.holderCount),
      topHoldersPct: number(audit.topHoldersPercentage),
      observedAt: new Date().toISOString(),
    };
  }

  rank(tokens) {
    return tokens.map((token) => this.evaluate(token))
      .filter((item) => item.eligible)
      .sort((left, right) => right.score - left.score);
  }
}

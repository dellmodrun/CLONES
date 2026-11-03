import { deriveCloneKeypair, signSwapTransaction } from './wallets.mjs';

export class TradeExecutor {
  constructor({ config, jupiter, risk }) {
    this.config = config;
    this.jupiter = jupiter;
    this.risk = risk;
  }

  readiness() {
    return {
      signer: Boolean(this.config.masterSeed),
      tokenMint: Boolean(this.config.tokenMint),
      jupiter: true,
      liveTrading: this.config.liveTrading,
    };
  }

  async wallet(cloneId) {
    if (!this.config.masterSeed) throw new Error('Signer is not configured');
    return deriveCloneKeypair(this.config.masterSeed, cloneId);
  }

  async swap(cloneId, intent) {
    this.risk.validateIntent(intent);
    const wallet = await this.wallet(cloneId);
    const order = await this.jupiter.order({
      inputMint: intent.inputMint,
      outputMint: intent.outputMint,
      amount: intent.amount,
      taker: wallet.publicKey.toBase58(),
      slippageBps: this.config.maxSlippageBps,
    });
    this.risk.validateOrder(order);
    const summary = {
      cloneId,
      wallet: wallet.publicKey.toBase58(),
      inputMint: intent.inputMint,
      outputMint: intent.outputMint,
      inAmount: order.inAmount,
      outAmount: order.outAmount,
      priceImpactPct: order.priceImpactPct ?? order.priceImpact ?? 0,
      router: order.router,
      reason: intent.reason,
      requestId: order.requestId,
    };
    if (!this.config.liveTrading) return { status: 'approval_required', summary };
    const signedTransaction = await signSwapTransaction(order.transaction, wallet);
    const execution = await this.jupiter.execute({ signedTransaction, requestId: order.requestId });
    return { status: 'submitted', summary, execution };
  }
}

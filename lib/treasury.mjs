import {
  Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { deriveCloneKeypair, deriveTreasuryKeypair } from './wallets.mjs';

export class TreasuryService {
  constructor(config) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  async address() {
    return this.config.masterSeed ? (await deriveTreasuryKeypair(this.config.masterSeed)).publicKey.toBase58() : null;
  }

  async fundClone(cloneId) {
    if (!this.config.liveTrading) throw new Error('Live trading is disabled');
    if (!this.config.masterSeed) throw new Error('Treasury signer is not configured');
    if (!(this.config.solUsdPrice > 0)) throw new Error('CLONES_SOL_USD_PRICE is required for funding');
    const treasury = await deriveTreasuryKeypair(this.config.masterSeed);
    const clone = await deriveCloneKeypair(this.config.masterSeed, cloneId);
    const fundingSol = this.config.cloneBudgetUsd / this.config.solUsdPrice;
    const budgetLamports = Math.ceil(fundingSol * LAMPORTS_PER_SOL);
    const reserveLamports = Math.ceil(this.config.fundingReserveSol * LAMPORTS_PER_SOL);
    const lamports = budgetLamports + reserveLamports;
    const treasuryFloor = Math.ceil(0.002 * LAMPORTS_PER_SOL);
    const balance = await this.connection.getBalance(treasury.publicKey, 'confirmed');
    if (balance < lamports + treasuryFloor) throw new Error('Treasury balance is below funding amount plus reserves');
    const transaction = new Transaction().add(SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: clone.publicKey,
      lamports,
    }));
    const signature = await sendAndConfirmTransaction(this.connection, transaction, [treasury], {
      commitment: 'confirmed',
      maxRetries: 3,
    });
    return {
      signature,
      lamports,
      budgetLamports,
      reserveLamports,
      usd: this.config.cloneBudgetUsd,
      treasury: treasury.publicKey.toBase58(),
      clone: clone.publicKey.toBase58(),
    };
  }
}

import { createHmac, randomBytes } from 'node:crypto';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

function decodeSeed(value) {
  const seed = Buffer.from(value || '', 'base64');
  if (seed.length !== 32) throw new Error('CLONES_MASTER_SEED must be a base64-encoded 32-byte secret');
  return seed;
}

export function generateMasterSeed() {
  return randomBytes(32).toString('base64');
}

export async function deriveCloneKeypair(masterSeed, cloneId) {
  if (!Number.isInteger(cloneId) || cloneId < 1) throw new Error('cloneId must be a positive integer');
  const seed = createHmac('sha256', decodeSeed(masterSeed))
    .update(`clones-wallet-v1:${cloneId}`)
    .digest()
    .subarray(0, 32);
  return Keypair.fromSeed(seed);
}

export async function deriveTreasuryKeypair(masterSeed) {
  const seed = createHmac('sha256', decodeSeed(masterSeed))
    .update('clones-wallet-v1:treasury')
    .digest()
    .subarray(0, 32);
  return Keypair.fromSeed(seed);
}

export async function importTreasuryKeypair(value) {
  const bytes = bs58.decode(String(value || '').trim());
  if (bytes.length !== 64) throw new Error('CLONES_TREASURY_SECRET must be a Base58 64-byte Solana private key');
  return Keypair.fromSecretKey(bytes);
}

export async function signSwapTransaction(transactionBase64, keypair) {
  const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
  await transaction.sign([keypair]);
  return Buffer.from(transaction.serialize()).toString('base64');
}

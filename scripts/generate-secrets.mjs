import { randomBytes } from 'node:crypto';
import { deriveTreasuryKeypair, generateMasterSeed } from '../lib/wallets.mjs';

const seed = generateMasterSeed();
console.log(`CLONES_ADMIN_TOKEN=${randomBytes(32).toString('base64url')}`);
console.log(`CLONES_MASTER_SEED=${seed}`);
console.log(`# TREASURY_ADDRESS=${(await deriveTreasuryKeypair(seed)).publicKey.toBase58()}`);
console.error('Store these values in the deployment secret manager. Never commit them or paste them into a public chat.');

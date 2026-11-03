# CLONES runtime

CLONES turns verified creator-fee revenue into autonomous trading instances called Clones. After the configured team share, each $10 allocation creates a funding plan: $5 buys and holds `$CLONES`, while $5 becomes that Clone's trading bank.

This repository contains the public frontend and the first operational backend layer. It provides durable state, idempotent fee ingestion, Clone lifecycle accounting, Solana mainnet treasury monitoring, authenticated administration endpoints, health reporting and server-sent live updates. It does not fabricate wallets, trades, balances or fees.

## Run

```powershell
npm start
```

Set production values through the process environment or service manager. The default local URL is <http://127.0.0.1:4319/>.

## Required production configuration

- `CLONES_TOKEN_MINT`: official CLONES mint after launch.
- `CLONES_TREASURY_ADDRESS`: a dedicated treasury address used only for tracked creator-fee receipts.
- `SOLANA_RPC_URL`: a production Solana RPC endpoint. The public endpoint is suitable only for development.
- `CLONES_ADMIN_TOKEN`: a strong secret for verified server-to-server fee ingestion and manual sync.
- `CLONES_SOL_USD_PRICE`: externally verified SOL/USD price when deposit accounting is enabled.
- `CLONES_AUTO_COUNT_DEPOSITS=true`: opt in only for a dedicated treasury; otherwise deposits are observed but never treated as creator fees.

Private keys must never be committed to this repository. The signer and trading executor remain deliberately disabled until a separate restricted signer service is configured and audited.

## API

- `GET /api/health` — runtime readiness without secrets.
- `GET /api/state` — public protocol state.
- `GET /api/clones` — Clone registry (`/api/agents` remains a compatibility alias).
- `GET /api/clone/:id` — one Clone and its public portfolio view.
- `GET /api/stream` — live state and Clone events over SSE.
- `POST /api/admin/fee-events` — authenticated, idempotent verified-fee ingestion.
- `POST /api/admin/sync` — authenticated Solana treasury synchronization.

Example fee event:

```json
{
  "id": "claim-signature-or-provider-event-id",
  "amountUsd": 11.12,
  "source": "pump-creator-fee",
  "signature": "solana-transaction-signature"
}
```

## Verification

```powershell
npm run check
npm test
```

The tests cover persistent accounting, idempotency, allocation thresholds and deterministic Clone creation.

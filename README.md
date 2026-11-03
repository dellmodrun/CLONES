# CLONES runtime

CLONES turns verified creator-fee revenue into autonomous trading instances called Clones. After the configured team share, each $10 allocation creates a funding plan: $5 buys and holds `$CLONES`, while $5 becomes that Clone's trading bank.

This repository contains the public frontend and production runtime. It provides durable state, idempotent fee ingestion, deterministic per-Clone Solana wallets, treasury funding, Clone lifecycle accounting, Jupiter Swap V2 execution, Jupiter Tokens V2 market discovery, fail-closed risk controls, authenticated administration, health reporting and server-sent live updates. It does not fabricate wallets, trades, balances or fees.

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

Private keys must never be committed to this repository. A 32-byte master seed deterministically derives the treasury and Clone wallets and is stored only in the host's persistent secret volume. Live trading, automatic activation and automatic strategy execution are separate switches and all default to off.

Market discovery can safely run before launch. It ranks real Solana tokens using liquidity, Jupiter organic score, holder count, organic buyer count, authority state and holder concentration. Discovery produces observations only unless both `CLONES_AUTO_TRADE=true` and `CLONES_LIVE_TRADING=true` are explicitly enabled.

## API

- `GET /api/health` — runtime readiness without secrets.
- `GET /api/state` — public protocol state.
- `GET /api/clones` — Clone registry (`/api/agents` remains a compatibility alias).
- `GET /api/clone/:id` — one Clone and its public portfolio view.
- `GET /api/stream` — live state and Clone events over SSE.
- `POST /api/admin/fee-events` — authenticated, idempotent verified-fee ingestion.
- `POST /api/admin/sync` — authenticated Solana treasury synchronization.
- `POST /api/admin/discovery/scan` — fetch and rank live market candidates; optional execution remains policy-gated.
- `POST /api/admin/clones/:id/activate` — fund one Clone, buy its permanent CLONES allocation and unlock its trading bank.
- `POST /api/admin/trades/execute` — run a risk-checked Jupiter Swap API V2 order for a Clone.

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

# Operations

## Before the token launch

1. Provision a Linux host with Docker and a persistent encrypted disk.
2. Run `npm run generate:secrets` on that host and store both values in its secret manager.
3. Add a production Solana RPC URL and a dedicated treasury address.
4. Keep `CLONES_TOKEN_MINT` empty and `CLONES_LIVE_TRADING=false`.
5. Keep `CLONES_AUTO_TRADE=false`; market discovery may remain enabled in observation mode.
6. Start with `docker compose up -d --build` and verify `/api/health`.

## When the CA is known

1. Set `CLONES_TOKEN_MINT` to the verified mint.
2. Confirm the Pump.fun coin URL and treasury address on-chain.
3. Restart the runtime and verify that `/api/health` reports the mint, treasury, admin and signer as configured.
4. Submit one small verified fee event and confirm one allocation without enabling trading.
5. Fund only the controlled test amount, execute one capped swap, verify the Solana signature, then enable the scheduler.
6. Set `CLONES_AUTO_ACTIVATE=true` only after the manual activation has been verified end to end.
7. Set `CLONES_AUTO_TRADE=true` only after reviewing the discovery feed and the first capped manual strategy trade.

## Recovery

Restore the data volume and the same master seed. Derived Clone addresses are deterministic. Never replace the seed on an existing deployment.

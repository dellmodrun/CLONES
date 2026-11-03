# Security model

- Never commit `.env`, the master seed, RPC credentials, Jupiter keys or wallet material.
- Generate secrets with `npm run generate:secrets` directly inside the production host or secret manager.
- The configured treasury address must match the address derived from the master seed; startup fails closed on a mismatch.
- Use a dedicated creator-fee treasury. Automatic deposit counting is disabled by default because unrelated deposits must not spawn Clones.
- Keep `CLONES_LIVE_TRADING=false` during launch verification.
- The official `$CLONES` mint is forbidden as a trade input, enforcing the never-sell rule in the executor.
- Every trade has a USD cap, maximum slippage and maximum price-impact limit.
- Admin requests require a constant-time bearer-token comparison.
- The container runs as a non-root user with Linux capabilities dropped.
- Back up the persistent data volume and secret manager independently. Losing the master seed makes derived Clone wallets unrecoverable.

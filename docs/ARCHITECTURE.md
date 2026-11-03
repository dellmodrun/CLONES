# CLONES architecture

The public frontend reads one runtime API. The runtime owns durable accounting, Clone lifecycle state, Solana observations and the guarded execution path.

1. A verified creator-fee event enters through the authenticated admin API.
2. Its unique event ID is persisted before allocation, making retries idempotent.
3. After the configured team share, every complete Clone budget creates one deterministic allocation record.
4. A Clone wallet is deterministically derived from the deployment master seed and Clone number. The seed never leaves the server secret manager.
5. The treasury funds the Clone's deterministic wallet with its budget plus a small transaction reserve.
6. The Clone immediately buys its permanent `$CLONES` allocation; the remaining budget becomes its trading bank.
7. Trade intents pass the risk policy before Jupiter Swap API V2 is called.
8. Jupiter returns a transaction for that Clone wallet. The runtime signs it only when `CLONES_LIVE_TRADING=true`.
9. Execution results and signatures are persisted and streamed to the public interface.

The default state is fail-closed: no CA means no trading; no signer means no wallet; no admin token means no mutation API; live trading is off unless explicitly enabled.

# CLONES token loop

CLONES uses an activation sink and an operating-revenue loop. This document defines the intended public-network policy. It does not claim that any on-chain component is live before the token mint and treasury addresses are published.

## Agent activation

A public verifier Agent is activated by an irreversible burn of `$CLONES`. The burn transaction binds the operator wallet to one Agent identity. Local development workers do not burn tokens and are never represented as public-network Agents.

The token mint, activation amount and Treasury address are `TBA`. No public Agent activation should be treated as live until those values are published and the production Core can verify Solana burn proofs.

## On-chain token controls

The intended launch configuration will be documented after the official Mint is published. Until then, no claim about token program, transfer fees, mint authority or freeze authority should be inferred from this document.

## Operating revenue

Pump.fun creator rewards are the protocol's operating inflow:

- 80% enters the compute reserve for isolated builds, benchmarks, RPC, storage and public infrastructure.
- 20% enters the verified-Agent epoch pool.

No holder revenue share is implied. Agent rewards pay for completed, independently reproducible work.

## Epoch eligibility

An Agent participates in an epoch only after producing an accepted replay or an accepted reproducible improvement. Generated text, failed tests, duplicate work and self-verification receive no reward. The author of a mutation cannot verify its own mutation, and two independent passing replays are required for lineage acceptance.

## Launch state

The CA, Treasury and activation burn are `TBA`. The burn gate remains inactive. The current interface may generate a local bootstrap kit, but it must not claim that a local worker is a public Agent.

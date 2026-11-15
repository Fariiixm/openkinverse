# ADR-0002: Backend, persistence and deterministic simulation

- Status: Accepted
- Date: 2026-11-15
- Decision owners: Engineering lead (autonomy policy in `CLAUDE.md`); owner may override

## Context

The server owns authoritative world and character state. Characters must keep "living" while no client is connected, and a returning user must find a plausible, reproducible state. LLM output is probabilistic and must never write state directly. The first deployment target is a single developer machine (local-first); hosted multi-user deployments come later.

## Options considered

1. **Node.js HTTP server + embedded SQLite + event log.** Single process, no external services, trivial setup. Node 24 ships `node:sqlite`, avoiding native build dependencies on Windows. Limited write concurrency, acceptable for local-first.
2. **Node.js + PostgreSQL.** Production-grade concurrency and tooling; requires Docker or a local install for every contributor and in tests.
3. **Separate simulation service + message queue.** Premature for current scale; violates the modular-monolith principle.

For simulation timing:

- **Real-time loop on the server** (tick continuously): wastes resources when nobody is watching and is hard to reproduce.
- **Lazy, deterministic catch-up** (simulate elapsed time on demand in fixed ticks): reproducible, cheap, and testable.

## Decision

- **Server:** Node.js 24, TypeScript, Fastify for HTTP with a versioned REST API under `/v1`. Realtime push (WebSocket) is added when the client needs it. Binds to `127.0.0.1` by default.
- **Persistence:** a `WorldStore` interface with a SQLite implementation (`node:sqlite`) first. Schema migrations are versioned SQL files. PostgreSQL is a later implementation of the same interface.
- **Event log:** every simulation state change is an append-only event with a monotonic sequence number per world. Snapshots are an optimization; state must be reconstructible from the initial state plus events.
- **Simulation model:** pure functions in `@openkinverse/simulation`. A world advances in fixed ticks of simulated time (default 60 s). Randomness uses a seeded PRNG whose state is part of world state. The same initial state, seed and inputs always produce the same events and final state.
- **Catch-up:** when a world is read or receives input, the server advances it from its last simulated time to the current wall-clock time, capped by a maximum catch-up window (default 7 days); time beyond the cap is skipped and an event records the skip.
- **Mind boundary:** dialogue providers return text plus structured `IntentProposal`s. A deterministic validator in the simulation layer checks each proposal against an allowlist and the current state; accepted intents become simulation inputs, rejected ones are logged as events. Providers never receive write access.

## Consequences

- Zero external services for development and CI.
- SQLite limits concurrent writers; a single server process serializes world updates per world, which is sufficient for local-first.
- Deterministic catch-up makes bugs reproducible from stored events and seeds.
- `node:sqlite` is marked as under active development in Node.js 24; the `WorldStore` interface contains this risk.

## Evidence

- Verified: Node.js v24.7.0 on the development machine. `node:sqlite` availability will be verified by the integration tests in issue #14.

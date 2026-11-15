# ADR-0002: Backend, persistence and deterministic simulation

- Status: Accepted (after principal-architect review on PR #28; ADR-0003 also reviewed by security-privacy-reviewer before merge)
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

- **Server:** Node.js 24, TypeScript, Fastify for HTTP with a versioned REST API under `/v1`. Realtime push (WebSocket) is added when the client needs it. Binds to `127.0.0.1` by default. Because any web page the user visits can send requests to localhost, the server enforces a `Host` header allowlist (`localhost`, `127.0.0.1`, configured names) against DNS rebinding and an `Origin` allowlist for browser requests against CSRF; state-changing routes reject requests without an allowed `Origin` unless they carry a local API token. Authentication arrives with #21.
- **Persistence:** a `WorldStore` interface with a SQLite implementation (`node:sqlite`) first. Schema migrations are versioned SQL files. PostgreSQL is a later implementation of the same interface.
- **Event log:** every simulation state change is an append-only event with a monotonic sequence number per world. Snapshots are an optimization; state must be reconstructible from the initial state plus events.
- **Simulation model:** pure functions in `@openkinverse/simulation`. A world advances in fixed ticks of simulated time (default 60 s). Randomness uses a seeded PRNG whose state is part of world state. The same initial state, seed and inputs always produce the same events and final state.
- **Segmentation invariance:** `advance(t0 -> t2)` must equal `advance(t0 -> t1)` then `advance(t1 -> t2)` for every `t1`. Therefore (a) only whole ticks are simulated, aligned to a world-fixed tick origin, and a partial-tick remainder is carried and never simulated; (b) external inputs (user interactions, accepted intents) are stamped with the tick at which they apply and are applied at tick boundaries in a defined order (tick, then input sequence number); (c) simulated time never moves backwards and inputs stamped in the past are applied at the next tick; (d) a property test asserts invariance over random segmentations.
- **Numeric determinism:** the server is the only authoritative executor. The engine avoids transcendental `Math` functions in state transitions (they are implementation-approximated across JavaScript engines) and uses bounded arithmetic; clients may run the engine only for previews.
- **Time zone:** each world stores an IANA time zone. Simulation time is UTC epoch milliseconds; schedules are evaluated in the world's local time, with DST transitions resolved by a fixed rule (skipped local times start at the next valid minute, repeated local times use the first occurrence).
- **Event volume:** ticks without state changes emit no events. Snapshots are taken at least every 1,000 events or 24 simulated hours. Rejected intents are logged with the intent type and reason only, never model-generated free text (see ADR-0004).
- **Catch-up:** when a world is read or receives input, the server advances it from its last simulated time to the current wall-clock time, capped by a maximum catch-up window (default 7 days); time beyond the cap is skipped and an event records the skip.
- **Mind boundary:** dialogue providers return text plus structured `IntentProposal`s. A deterministic validator in the simulation layer checks each proposal against an allowlist and the current state; accepted intents become simulation inputs, rejected ones are logged as events. Providers never receive write access.

## Consequences

- Zero external services for development and CI.
- SQLite limits concurrent writers; a single server process serializes world updates per world, which is sufficient for local-first.
- Deterministic catch-up makes bugs reproducible from stored events and seeds.
- `node:sqlite` is marked as under active development in Node.js 24; the `WorldStore` interface contains this risk.

## Evidence

- Verified: Node.js v24.7.0 on the development machine. `node:sqlite` availability will be verified by the integration tests in issue #14.

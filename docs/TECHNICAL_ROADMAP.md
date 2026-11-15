# Technical roadmap

This document maps the long-term capabilities in `docs/PRODUCT_VISION.md` to milestones M0 to M5 and to the GitHub backlog. It complements `docs/ROADMAP.md` (product phases) with module dependency order and measurable exit criteria. It is a planning document: nothing listed here is implemented unless `docs/STATUS.md` says so.

- Last updated: 2026-11-15, from `gh issue list --state all` (issues #2 to #30; #27 and #28 are pull requests).
- Decisions referenced: ADR-0001 to ADR-0003 (proposed in PR #28), ADR-0004 (issue #29).
- Exit criteria are verified by automated tests or by a recorded manual device test. "Agents say it is done" is not an exit criterion (`docs/ROADMAP.md`, release rule).

## Capability to milestone map

| Product capability | M0 | M1 | M2 | M3 | M4 | M5 |
| --- | --- | --- | --- | --- | --- | --- |
| Character Studio | | Minimal profile via API | Customization studio (#20) | | | Asset/animation/voice providers via SDK (#25) |
| Persistent World | | One room, room-relative poses, SQLite world store (#14) | | | Object affordances, navigation graph (#23) | |
| Autonomous Simulation | ADR-0002 (#6) | Needs, schedule, activities, event log (#11), catch-up (#12) | | | Relationships, multi-agent (#23) | |
| Companion Mind | | DialogueProvider v1, mock, intent validator (#13), memory (#17, ADR-0004 #29) | | | Local LLM adapter (#24) | Provider SDK (#25) |
| Reality Runtime | ADR-0001 (#5) | Web viewer (#15), WebXR room-origin placement (#16) | Cross-device compatibility report (not yet in backlog) | | Depth, occlusion, hand tracking (not yet in backlog) | Additional devices (not yet in backlog) |
| Portable Identity | ADR-0003 (#7) | CharacterBundle v0 schema (#10) | Export/import archive (#18) | | | Signatures (not yet in backlog) |
| Object Binding | ADR-0003 (#7) | | QR deep link, NFC resolution (#19) | Resolution subject to grants (#22) | | |
| Social Sharing | Scopes in ADR-0003 (#7) | Scope types and defaults (#10) | | Accounts (#21), grants and revocation (#22) | | |
| Provider and Plugin SDK | | Versioned provider interface pattern (#13) | | | | Plugin SDK with capability allowlists (#25) |
| Engineering foundation | Governance (#2), CI (#3), branch protection (#4), Graphify evaluation (#9), monorepo (#8) | Test strategy (#30) | | | | Release automation (#26) |

## Module dependency order

Modules follow the bounded contexts in `docs/ARCHITECTURE_PRINCIPLES.md`. Arrows mean "must exist before".

```
#8 monorepo scaffold
  -> #10 @openkinverse/core (IDs, scopes, CharacterBundle v0, MemoryRecord v0 schemas)
       -> #11 @openkinverse/simulation (pure engine, event log)
            -> #12 catch-up
       -> #13 @openkinverse/mind (DialogueProvider v1, mock, intent validator; validator depends on #11 state types)
       -> #14 server (WorldStore on SQLite, /v1 REST; integrates #11, #12, #13)
            -> #17 memory module (MemoryStore, derivation from #11 events, retrieval for #13)
            -> #15 web viewer (consumes /v1)
                 -> #16 WebXR placement (room-origin alignment)
  -> #18 bundle archive (needs #10, #14)
       -> #19 QR/NFC resolution (needs #18 identity URI, later #22 grants)
  -> #21 accounts and devices (needs #14)
       -> #22 grants and revocation (needs #21, #17, #19)
  -> #23 affordances, navigation, relationships (needs #11 stable)
  -> #24 local LLM adapter (needs #13 contract tests)
  -> #25 plugin SDK (needs stable provider interfaces from #13, #24)
```

Rules for ordering:

- Schemas (`@openkinverse/core`) change before the modules that consume them; contract changes go through an ADR update.
- `#30` (test strategy) should land before or alongside #11 so that determinism and replay tests are designed in, not retrofitted.
- `#17` depends on the ADR-0004 decision being accepted; `#13` and `#17` share the `DialogueRequest.context` contract and should be sequenced, not developed in parallel on the same files.
- Security-sensitive modules (#17, #18, #21, #22, #25) require a `security-privacy-reviewer` report before merge (`docs/QUALITY_GATES.md`).

## Milestones

### M0 Foundation

Scope: governance (#2, closed), CI (#3), branch protection (#4, blocked on repository administration permission, see `docs/STATUS.md`), ADR-0001 to ADR-0003 (#5, #6, #7), monorepo scaffold (#8), Graphify evaluation (#9, closed).

Exit criteria:

1. ADR-0001, ADR-0002 and ADR-0003 are merged with status `Accepted`, and review findings are resolved or tracked as issues.
2. `npm run check` (format, lint, typecheck, tests) passes on a clean clone on Windows and Linux; command output is recorded in the PR.
3. CI runs `npm run check` and the hygiene job on every pull request, with least-privilege permissions, and a deliberately failing test makes CI fail (verified once).
4. Branch protection on `main` requires CI, or the owner-blocked state is recorded in `docs/STATUS.md`.

### M1 Persistent companion slice

Scope: #10, #11, #12, #13, #14, #15, #16, #17, #29 (ADR-0004), #30.

Exit criteria:

1. Determinism: for a fixed seed and input sequence, the engine produces identical event sequences and final state across 3 runs and across single-step vs multi-step catch-up (automated test).
2. Replay: rebuilding state from the initial state plus the stored event log equals the live state (automated test on at least one 7-day simulated scenario).
3. Bounded catch-up: catching up beyond the maximum window completes in bounded time and records a skip event; the time budget is measured and recorded in the PR (target to be set in #30).
4. Persistence: a character created through `/v1`, followed by a server restart, returns the same state plus deterministic catch-up (integration test against a temporary SQLite database).
5. Dialogue: the mock provider round-trips through `/v1`; non-allowlisted or state-illegal intents are rejected and logged, never executed (contract tests).
6. Memory: ADR-0004 acceptance criteria 1 to 9 pass as automated tests.
7. Privacy defaults: a test enumerates all created resources and confirms default scope `private`; the server binds to `127.0.0.1` by default; no network call leaves the machine during the test suite with the mock provider.
8. Viewer: the desktop web viewer renders the room and character from server state and labels needs and activities as simulation state; automated accessibility check (tool chosen in #30) reports no critical violations.
9. AR: on at least one ARCore-capable Android device, a recorded manual test shows placement, app close, reopen and re-alignment; the device model and browser version are recorded. Unsupported devices show the fallback message (automated test of the capability check). If no device is available, this criterion is marked blocked, not passed.
10. `docs/TEST_STRATEGY.md` (#30) maps every M1 scenario to an automated test or a manual device procedure.

### M2 Portable characters

Scope: #18, #19, #20.

Exit criteria:

1. Export then import of a bundle on a fresh server reproduces the character profile, personality, schedule and needs configuration (round-trip test); memories and world state are absent unless explicitly opted in.
2. The importer rejects path traversal, absolute paths, symlinks, oversized archives and unknown major versions (negative test suite with at least one case per rule).
3. QR and NFC payloads contain only an identity URI; resolving it for a private character as a non-owner returns the same response as a nonexistent ID (test).
4. The customization studio creates and edits a character with schema validation and passes the accessibility check from M1.
5. The memory export encryption decision (ADR-0004 open question 2) is recorded before any bundle can include memories.

### M3 Social and shared companions

Scope: #21, #22.

Exit criteria:

1. Every `/v1` route enforces authorization; a tenant-isolation test suite shows user B cannot read or modify any resource of user A without a grant.
2. Sharing a character grants no access to memories, conversation records, worlds, anchors or room data (test per resource type).
3. Revoking a grant takes effect on the next request, including dialogue retrieval context (test).
4. The ADR for memories from non-owner interactions (ADR-0004 open question 1) is accepted before friends can talk to a shared character.
5. Account deletion cascades over owned characters using the ADR-0004 deletion procedure (test).

### M4 Rich autonomy and perception

Scope: #23, #24.

Exit criteria:

1. Objects expose affordances that satisfy needs; navigation over the room graph and relationship scores remain deterministic and replayable (M1 determinism tests extended).
2. Character deletion in a multi-character world performs the ADR-0004 baseline rebase; remaining characters replay identically from the new baseline (test).
3. The local LLM adapter is disabled by default, passes the same contract tests as the mock, and adds no paid API (contract test run recorded with model and server version).

### M5 Ecosystem

Scope: #25, #26.

Exit criteria:

1. A third-party example plugin runs only with the capabilities declared in its manifest; an undeclared capability call is denied and audited (test).
2. Tagged releases are produced from Conventional Commits with a changelog and the release gate in `docs/QUALITY_GATES.md` (one dry-run release recorded).

## Gaps in the current backlog

The following capabilities from `docs/PRODUCT_VISION.md` or `docs/ROADMAP.md` have no issue yet. They are listed for the engineering lead to triage; this document does not create them.

- Repository license selection (no `LICENSE` file exists).
- Local server threat model: `Host`/`Origin` allowlist against DNS rebinding and CSRF for the unauthenticated localhost API (M1).
- Secure-context device access path for WebXR testing (for example `adb reverse` or local TLS) (M1).
- Permission and consent UX for camera, microphone and cloud inference (M1 for camera in #16).
- Voice/speech provider interface with mock (`docs/ROADMAP.md` Phase 1 mentions voice/chat).
- Event-log snapshots and compaction, including the deletion baseline rebase (M1 or M4).
- Logging and observability policy with no private data in logs (M1).
- Local backup and restore of the world database (M1 or M2).
- Cross-device compatibility report (Phase 2).
- Bundle signatures (product vision, Portable Identity).
- Multi-user interaction sessions and moderation controls for public characters (Phase 3).
- Depth, occlusion and hand tracking; multi-agent interactions; smart-home integrations with consent (Phase 4).
- Additional devices and spatial platforms; performance budgets and scale testing (Phase 5).

# Test strategy

- Status: Proposed (issue #30)
- Applies to: milestone M1 (Phase 1 vertical slice) and later phases until superseded
- Related: `docs/QUALITY_GATES.md`, ADR-0001 (platform and runtime), ADR-0002 (backend, persistence and simulation), ADR-0003 (domain contracts v0)

This document defines how OpenKinverse is tested: which test levels exist, what each level must prove, and the concrete acceptance scenarios that decide whether M1 is done. It does not claim that any of these tests exist yet. A scenario counts as passing only when its test has been run and the result recorded in a PR or in `docs/STATUS.md`.

Tooling follows ADR-0001 and issue #8: Vitest for automated tests, run through `npm run check` locally and in CI. Exact script names for individual test levels are fixed by the scaffold and must be kept in sync with this document.

## 1. Principles

1. **Deterministic by default.** Automated tests must not depend on wall-clock time, network, paid APIs, real model output, locale, time zone or test execution order. Time, randomness and IDs are injected.
2. **No paid or external services in CI.** Every provider has a deterministic mock and a contract test suite that the mock passes. Real providers are tested only behind an explicit opt-in (see section 4).
3. **Deny by default is tested, not assumed.** Every access path that can expose private data has at least one negative test (missing grant, wrong owner, unknown scope, permission denied).
4. **Simulation is separate from model output.** Tests for the simulation never use a dialogue provider; tests for the mind boundary verify that provider output can only enter state through the validator.
5. **Test the changed behavior.** Every behavior change ships with tests at the lowest level that can prove it, plus a higher-level test when the behavior crosses a module boundary.
6. **Honest reporting.** Manual and device tests are reported as manual, with device, OS, browser and build identifiers. A skipped test is reported as skipped, not as passed.

## 2. Test levels

| Level | Scope | Runs where | Required for |
| --- | --- | --- | --- |
| Unit | One module, pure functions, no I/O | Every PR, CI | All domain logic in `core`, `simulation`, `mind` |
| Contract | A versioned interface and every implementation of it | Every PR, CI (mocks); opt-in (real providers) | `DialogueProvider`, `WorldStore`, `SpatialAnchorProvider`, schema readers |
| Integration | Several modules plus real local infrastructure (SQLite file, HTTP server on loopback) | Every PR touching server/persistence, CI | Server, persistence, migrations, REST API |
| Acceptance | End-to-end user-visible scenarios from section 7, through the public API or UI | CI where automatable; release gate | M1 exit criteria |
| Manual device | Real hardware: camera, WebXR, touch, performance | Before closing device issues and before releases | #16, cross-device claims |

### 2.1 Unit tests

- Located next to the code (`*.test.ts`) in each workspace package.
- No file system, network, timers or `Date.now()`; clocks and PRNGs are passed in.
- Schema tests use table-driven valid and invalid fixtures. Every rejection test asserts the specific error path, not just "throws".
- Coverage is a signal, not a gate. Branch coverage of validators, authorization checks and schema parsers is expected to be complete; a missing branch there is a finding.

### 2.2 Contract tests

- A contract suite is a function, for example `runDialogueProviderContract(factory)`, exported from the package that defines the interface. Each implementation's test file calls it with its own factory.
- The mock implementation must pass the full suite in CI. A real implementation must pass the same suite, unmodified, before it can be merged; implementation-specific tests are additions, never replacements.
- Contracts are versioned with the interface (`DialogueProvider` v1, `WorldStore` v1). A breaking interface change creates a new suite version; the old suite stays until the old interface is removed.

### 2.3 Integration tests

- Use a fresh temporary SQLite database per test file (unique temp directory, removed in teardown). Never reuse a developer's real data directory.
- Start the HTTP server on `127.0.0.1` with an ephemeral port. Tests assert that the default bind address is loopback.
- Migrations run from an empty database in every integration run. Each new migration adds a test that upgrades a database created by the previous schema version with representative data.

### 2.4 Acceptance tests

- Written against the public REST API (`/v1`) and, for the web client, against the rendered UI using a headless browser once #15 lands. Tool choice for browser tests is decided in #15 and recorded here.
- Each scenario in section 7 has a stable ID (for example `M1-SIM-02`) used in test names, so results can be traced to this document.

### 2.5 Manual device tests

- Required for anything that depends on camera, WebXR, sensors or real device performance.
- Recorded in the PR using this template:

```
Scenario ID:
Build / commit:
Device, OS version:
Browser and version:
Steps performed:
Result: pass | fail | blocked
Notes (including anything not verified):
```

- A claim such as "works on Android" is only allowed for the exact device/browser combinations recorded.

## 3. Deterministic simulation and replay testing

These tests implement the requirements of ADR-0002 for `@openkinverse/simulation` (#11, #12).

1. **Same inputs, same output.** For a fixed initial state, seed and input sequence, running the engine twice produces byte-identical serialized event lists and final state. Tests run at least 3 different seeds and one long run (at least 10 080 ticks, one simulated week at 60 s ticks).
2. **Replay equivalence.** `replay(initialState, events)` equals the final state produced by `advance`. Tested for every event type the engine can emit; adding a new event type without a replay test is a blocker.
3. **Chunking independence.** Advancing N ticks in one call equals advancing in arbitrary splits (for example 1 + (N-1), N/2 + N/2, and N single steps). This catches hidden state outside the world state.
4. **PRNG state is part of world state.** Serializing and deserializing world state mid-run, then continuing, gives the same result as an uninterrupted run.
5. **Golden fixtures.** A small set of checked-in fixtures (initial state, seed, inputs, expected events hash) protects against unintended behavior changes. Changing a golden fixture requires a note in the PR explaining why the behavior change is intended.
6. **Property tests.** For random seeds: needs stay within their configured bounds, sequence numbers are strictly monotonic per world with no gaps, simulated time never moves backwards, and positions stay inside the room bounds.
7. **No ambient nondeterminism.** A lint rule or test guard forbids `Math.random`, `Date.now`, `new Date()` without arguments and `performance.now` inside `@openkinverse/simulation`.
8. **Catch-up bounds (#12).** Elapsed time up to the cap is simulated tick by tick; elapsed time beyond the cap (default 7 days) is skipped and produces exactly one skip event recording the skipped duration. Negative elapsed time (clock moved backwards) produces no events and does not throw.

## 4. Provider contract tests

Applies to `DialogueProvider` (#13) first and to every later provider interface (speech, vision, anchors, storage).

The shared contract suite for `DialogueProvider` v1 must verify at least:

- The response matches the versioned response schema: text plus a list of `IntentProposal`s, each schema-valid.
- The provider declares its interface version and capabilities; a consumer rejects an unsupported version.
- Malformed provider output (invalid JSON, unknown intent type, extra fields, oversized text) is rejected by schema validation and surfaced as a typed error, not a crash.
- Timeouts and provider errors are reported as typed failures; the caller can continue with simulation unaffected (offline and provider-failure path).
- The provider receives only the context it is given; it has no handle to `WorldStore` or any write API (checked by the type signature and by a test that the provider factory receives no store).
- The mock provider is deterministic: the same input yields the same output across runs.

Real providers:

- Real-provider contract tests are skipped unless explicitly enabled (for example by an environment variable naming the provider). Skips are reported as skipped.
- They never run in default CI, never require secrets in the repository, and never send private memories, room data or camera frames unless the test fixture is synthetic.
- Adding a real provider requires the contract suite to pass against it once, with the command and output recorded in the PR.

Intent validator (#13):

- Only allowlisted intent types are accepted.
- An allowlisted intent that is illegal in the current state (for example moving to a non-existent room position or starting an activity whose preconditions fail) is rejected.
- Every rejection is logged as an event with the reason; the world state is otherwise unchanged (state hash before equals state hash after, excluding the rejection event).
- Proposals containing shell commands, code, URLs to fetch or tool calls outside the allowlist are rejected; nothing is executed. A test feeds such proposals through the full mock-provider path and asserts no side effects.

## 5. Privacy, permission and deny-by-default tests

Required whenever a change touches data access, sharing, memory, camera, microphone or spatial data. These changes also need an independent security-privacy review per `docs/QUALITY_GATES.md`.

### 5.1 Sharing scopes and authorization

- New resources default to `private`. Tested for every resource type that has a scope (characters, memories, worlds).
- Missing, `null`, empty, unknown or differently-cased scope values (`"Public"`, `"shared"`) are rejected, never coerced to a default.
- For each protected endpoint: the owner succeeds; a different user without a grant gets a denial that does not reveal whether the resource exists (same status and body shape as not found, as decided by #14); a user with a grant for a different resource is denied.
- Sharing a character profile does not expose its memories, worlds, anchors, room maps or conversation history (one test per related resource).
- Revoking a grant takes effect on the next request.

### 5.2 Memory (#17)

- Created memories are `private` and carry provenance (source event ID or dialogue reference).
- List returns only the owner's memories.
- Export contains all and only the owner's memories, in the documented format.
- Delete removes the memory from the store, from subsequent list/export results and from any derived index or cache; a test reads the SQLite database directly to confirm the row is gone (or tombstoned without content, if a later ADR chooses tombstones).
- Deleted memories are not reintroduced by replay or catch-up.

### 5.3 Camera, microphone and spatial data (#16)

- The camera is not requested until the user explicitly starts AR. Test: loading the client does not call `navigator.xr.requestSession` or `getUserMedia`.
- Permission denied: the client shows a clear message and falls back to the 3D viewer; no retry loop, no crash.
- No upload: during an AR session, no request leaves the client other than to the configured local API, and no request body contains image data. Verified by intercepting network requests in an automated browser test where possible, and by inspecting the browser network panel in the manual device test.
- Only room-relative poses are persisted. No hit-test geometry, camera frames or device location are stored or sent.

### 5.4 Network and telemetry

- The server binds to `127.0.0.1` by default (test asserts the bound address).
- No outbound network requests during the automated test run, except to loopback. A test helper fails the test if an outbound request is attempted.
- No telemetry or analytics code paths exist; any added later require an ADR and default-off tests.

## 6. Import and export security tests

Applies to CharacterBundle v0 (#10) now and to bundle import/export features in Phase 2.

Schema and content:

- Unknown fields, unknown `bundleFormat`, unknown major `schemaVersion` and missing required fields are rejected.
- `includes.memories` and `includes.worldState` default to `false`; a default export contains no memory, world, anchor or room-map data (tested by scanning the exported manifest for known private field names and IDs with `mem_`, `wld_`, `room_`, `anc_` prefixes).
- Personality traits outside their bounds, oversized strings and excessive array lengths are rejected.

Asset paths and archives:

- Rejected paths: `..` segments, absolute paths (`/etc/x`, `C:\x`, `\\server\share`), drive-relative paths, backslash separators, URL-encoded traversal (`%2e%2e%2f`), NUL bytes, empty segments, Unicode look-alikes that normalize to `..`, and paths that differ only by case on case-insensitive file systems.
- When archive import exists: symlinks and hard links are rejected; total uncompressed size, per-file size, file count and compression ratio are capped (zip-bomb test); duplicate entry names are rejected; extraction happens in a temporary directory and is verified to write nothing outside it.
- Every asset's `sha256` and `bytes` are verified; a mismatch rejects the whole bundle (no partial import).
- Declared `mediaType` is checked against an allowlist; executable or script content is rejected or stored as inert data and never executed.

Round trip:

- Export then import yields an equal character (same ID, profile, schedule and needs).
- Importing a bundle whose `chr_` ID already exists follows the documented conflict policy and never silently overwrites another owner's character.

## 7. M1 acceptance scenarios

Each scenario lists the issue it closes, the level at which it is tested, and its pass criteria. M1 is complete only when every scenario passes or is explicitly marked blocked with a reason.

### #10 Core: IDs, scopes, CharacterBundle v0

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-CORE-01 | Unit | Generated IDs match `^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$` for every prefix in ADR-0003; IDs with a wrong prefix, wrong length or excluded letters (`I`, `L`, `O`, `U`) are rejected. |
| M1-CORE-02 | Unit | Scope parser accepts exactly `private`, `invited`, `public`; any other value, including missing, is rejected; the default for new resources is `private`. |
| M1-CORE-03 | Unit | A minimal valid manifest fixture parses; at least one invalid fixture per required field and per rule in section 6 is rejected with the expected error path. |
| M1-CORE-04 | Unit | A manifest omitting `includes` parses with `memories: false, worldState: false`; the schema has no field that can carry room maps or anchors. |
| M1-CORE-05 | Unit | TypeScript types are derived from the schemas (`z.infer`); a type-level test fails to compile if a type and schema drift. |

### #11 Simulation: deterministic engine and event log

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-SIM-01 | Unit | Same initial state, seed and inputs give byte-identical events and final state across two runs, for at least 3 seeds and one 10 080-tick run. |
| M1-SIM-02 | Unit | Replaying the event log from the initial state equals the final state, for every event type. |
| M1-SIM-03 | Unit | Advancing in one call equals advancing in split calls (section 3, item 3). |
| M1-SIM-04 | Unit | Needs decay at configured rates and stay within bounds; activity selection follows the schedule and switches when a need crosses its threshold (fixture with an expected activity timeline). |
| M1-SIM-05 | Unit | Movement is room-relative and positions never leave room bounds (property test). |
| M1-SIM-06 | Unit | The simulation package contains no ambient time or randomness (guard from section 3, item 7). |

### #12 Simulation: offline catch-up

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-CATCH-01 | Unit | Catching up 8 hours gives the same state as advancing the equivalent number of ticks. |
| M1-CATCH-02 | Unit | Catching up 30 days simulates exactly 7 days of ticks and emits one skip event for the remaining 23 days. |
| M1-CATCH-03 | Unit | Zero or negative elapsed time emits no events and does not throw. |
| M1-CATCH-04 | Unit, Integration | The "while you were away" summary is derived only from events in the catch-up range, and is identical when computed twice; it describes needs and moods as simulation state. |

### #13 Mind: DialogueProvider v1, mock and validator

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-MIND-01 | Contract | The mock provider passes the full `DialogueProvider` v1 contract suite (section 4). |
| M1-MIND-02 | Unit | Mock output is deterministic for the same input. |
| M1-MIND-03 | Unit | Allowlisted and legal intents are accepted and become simulation inputs. |
| M1-MIND-04 | Unit | Non-allowlisted, illegal-in-state, malformed and code/shell-bearing intents are rejected and logged as events; state is otherwise unchanged; nothing is executed. |
| M1-MIND-05 | Unit | A provider error or timeout leaves the world advancing normally and returns a typed error to the caller. |

### #14 Server: SQLite world store and REST API

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-SRV-01 | Integration | The SQLite `WorldStore` passes the `WorldStore` v1 contract suite against a temporary database. |
| M1-SRV-02 | Integration | Persistence and restart: create a character and world, advance time, stop the server, start a new server process on the same database file; state and event log are identical to before the restart. |
| M1-SRV-03 | Integration | `/v1` endpoints for characters, world state, advance time and dialogue return schema-valid responses; invalid request bodies return 4xx with a structured error, never 500. |
| M1-SRV-04 | Integration | Default bind address is `127.0.0.1`; binding elsewhere requires explicit configuration. |
| M1-SRV-05 | Integration | Migrations apply cleanly from an empty database and are idempotent on re-run; a database with a newer unknown schema version is refused with a clear error rather than modified. |
| M1-SRV-06 | Integration | Authorization tests from section 5.1 for every endpoint that exposes a scoped resource. |
| M1-SRV-07 | Integration | Repeating an advance or dialogue request with the same idempotency key does not duplicate events. |

### #15 Web: 3D viewer

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-WEB-01 | Acceptance | In a desktop browser without WebXR, the client loads the room and character from the local server and renders them without errors in the console. |
| M1-WEB-02 | Acceptance | Needs and current activity are shown and labeled as simulation state; no UI text claims the character has real feelings. |
| M1-WEB-03 | Acceptance | Chat through the mock provider shows the reply; an accepted intent updates the displayed state after the next server response. |
| M1-WEB-04 | Acceptance, Manual | Server unavailable: the client shows an offline/error state and recovers when the server returns. |
| M1-WEB-05 | Acceptance | Accessibility: main controls reachable by keyboard and labeled; automated accessibility scan reports no critical violations (tool chosen in #15). |

### #16 AR: WebXR placement and room-relative anchors

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-AR-01 | Manual device | On at least one recorded ARCore-capable Android device with Chrome, the user places the room origin via hit-test and the character renders at its room-relative position. |
| M1-AR-02 | Manual device | Close the browser tab, reopen, run the re-alignment flow; the character reappears at the same room-relative position and with the caught-up state. |
| M1-AR-03 | Acceptance, Manual | The camera is requested only after the user starts AR; denying permission shows a clear message and falls back to the 3D viewer. |
| M1-AR-04 | Acceptance | On a browser without `immersive-ar` (desktop, iOS Safari), the client shows a clear unsupported message and the 3D viewer. |
| M1-AR-05 | Acceptance, Manual | During an AR session no request carries image data and no request goes anywhere other than the configured local API; only room-relative poses are persisted. |

### #17 Memory: private store with provenance

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-MEM-01 | Unit, Integration | New memories are `private` and carry provenance referencing an existing event or dialogue. |
| M1-MEM-02 | Integration | The owner can list and export memories; another user without a grant gets the denial response from section 5.1. |
| M1-MEM-03 | Integration | Delete removes the memory from list, export and the database (verified by direct query), and it does not reappear after server restart, replay or catch-up. |
| M1-MEM-04 | Integration | A default character bundle export contains no memories. |

### M1 end-to-end scenario

| ID | Level | Pass criteria |
| --- | --- | --- |
| M1-E2E-01 | Acceptance | From a clean clone, following the README only: install, start the server, open the viewer, see the character; chat once; stop everything; simulate 8 hours elapsed (injected clock); restart; the viewer shows the caught-up state and the away summary. No network access beyond loopback is required. |

## 8. Flaky-test policy

- A test that fails and then passes on retry without a code change is flaky. CI does not auto-retry tests to hide flakiness.
- When a flaky test is found: open an issue labeled `flaky` with the failing output, then either fix it in the same PR or quarantine it.
- Quarantine means `it.skip` (or an equivalent tag) with a comment linking the issue. Quarantined tests are listed in `docs/STATUS.md`. A quarantined test may not be the only test covering a privacy, authorization, validator or determinism requirement; in that case the flakiness is a blocker and must be fixed.
- Quarantine is limited to 14 days; after that the test is fixed or deleted with a replacement.
- Common causes to check first: real timers or clocks, shared temporary directories or ports, test ordering, unawaited promises, and locale or time-zone dependent formatting.

## 9. Reporting

- PR descriptions list the exact commands run and their results, including skipped tests and manual scenarios not performed.
- QA reports reference scenario IDs from section 7 and classify findings as blocker, major, minor or nit, per `docs/QUALITY_GATES.md`.
- This document is updated when a test level, tool or scenario changes. Scenario IDs are never reused for a different meaning.

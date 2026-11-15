# ADR-0004: Companion lifecycle, memory and continuity model

- Status: Proposed
- Date: 2026-11-15
- Decision owners: Engineering lead with principal-architect input; `security-privacy-reviewer` input required before acceptance (memory is a sensitive area per `docs/QUALITY_GATES.md`); owner may override
- Related: issue #29; depends on ADR-0002 (deterministic simulation, event log, catch-up) and ADR-0003 (IDs, sharing scopes, CharacterBundle v0), both proposed in PR #28; constrains issues #12, #13, #14, #17 and #18

## Context

A companion must feel continuous: it keeps a simulated routine while nobody is watching, remembers what happened, and can be exported, moved or deleted. At the same time:

- Simulation state is deterministic and authoritative (ADR-0002). Memory is not the same as event history (`docs/ARCHITECTURE_PRINCIPLES.md`, critical separation 4).
- Memories, conversation history and location data are private by default and must be inspectable, exportable and deletable by the owner (`CLAUDE.md`, `docs/PRODUCT_VISION.md`).
- LLM output is probabilistic. Providers may propose structured intents but never write state (ADR-0002). The same rule must hold for memory.
- Memory text is passed to dialogue providers and may contain adversarial content (prompt injection), especially once friends interact with shared characters (M3) or bundles are imported from strangers (M2).
- The first deployment is local-first, single owner, SQLite (ADR-0002). Multi-user sharing arrives in M3, but contracts defined now must not need a breaking change then.

Three questions are coupled and are decided together here: (1) where memory lives relative to the event log, (2) what "delete" means when state must be replayable, and (3) how memory reaches a dialogue provider without granting it authority.

## Options considered

### A. Where memory lives

1. **Memory as a projection of the event log.** Memories are views computed from simulation events plus annotation events (dialogue, owner notes) appended to the same log.
   - Benefits: one source of truth; trivially replayable; no derivation drift.
   - Drawbacks: dialogue text and owner notes would enter the authoritative log, so deleting a memory means rewriting the log and breaks the replay guarantee of ADR-0002; the simulation log would accumulate private free text; retention per memory type is hard to express; export of "the character without memories" requires filtering a log rather than omitting a table.
2. **Separate Memory module and store with provenance references to events (recommended).** Memory records live in their own tables owned by the Memory module. Episodic memories are derived from events by versioned, deterministic rules and reference their source event IDs. The simulation never reads memory.
   - Benefits: deleting a memory never touches the world event log, so replay stays valid; private free text stays out of the authoritative log; retention, scope and export are per record; matches the bounded contexts in `docs/ARCHITECTURE_PRINCIPLES.md`.
   - Drawbacks: derived data can drift from events if derivation rules change (mitigated by rule versioning and tombstones below); two stores to keep transactionally consistent (same SQLite database and transaction in M1).
3. **External memory service or vector database as the primary store** (a hosted memory API or a standalone vector DB).
   - Benefits: semantic retrieval out of the box.
   - Drawbacks: adds an external service and possibly user-data upload, contrary to local-first and "never silently add an external service"; deletion guarantees depend on a third party; not needed for M1 volumes. Can be added later as an optional index adapter, never as the system of record.

### B. Deletion semantics

1. **Soft delete (flag `deleted=true`).** Simple, reversible. Rejected: the content remains on disk and in exports of the database, which does not meet the user expectation of "delete".
2. **Hard delete of content plus a content-free tombstone (recommended).** The memory content, embeddings and any derived summaries are physically deleted. A tombstone keeps only the ID, the derivation key (if derived) and the deletion time, so that re-derivation does not resurrect the memory and references resolve to "deleted" instead of dangling.
3. **Crypto-shredding** (encrypt each character's private data with its own key and delete the key). Strong for backups and hosted replicas where physical deletion is hard. Deferred: it adds key management that M1 does not need; it is the preferred path once hosted deployments or remote backups exist (M3 or later), and it is compatible with option 2.

### C. Retrieval for dialogue

1. **Pass all memories.** Simple; breaks context limits quickly, maximizes data sent to providers, and maximizes the prompt-injection surface. Rejected.
2. **Deterministic ranking over a scope-filtered candidate set (recommended for M1).** Filter by audience permission first, then rank by a deterministic score (recency, owner-set pin, type weight, keyword overlap with the current turn), then truncate to a token or item budget. Reproducible and testable with the mock provider.
3. **Embedding-based semantic retrieval.** Better recall for large memory sets; requires an embedding provider (local or cloud) and stores derived vectors that must be deleted with their memory. Added later behind a versioned `MemoryIndexProvider` interface; the scope filter of option 2 still runs first.

## Decision

Adopt A2, B2 and C2, with the contracts below. Field names are normative for `@openkinverse/core` schemas; exact Zod definitions are implemented in issue #17.

### 1. Companion lifecycle

A companion is a character (`chr_`) plus the world it inhabits (`wld_`). The canonical companion definition stored by the server is the ADR-0003 `CharacterDefinition` (the same schema used in `CharacterBundle`), so export and import are lossless for the definition; API representations derive from it. The stored lifecycle state is one of `active | paused | archived`:

| State | Simulation | Dialogue | Notes |
| --- | --- | --- | --- |
| `active` | Advances lazily by deterministic catch-up when read or when it receives input (ADR-0002) | Allowed | Default after creation or import |
| `paused` | Simulated time is frozen; on resume the paused interval is skipped, recorded by `simulation.paused` / `simulation.resumed` events | Disabled | Owner-initiated; lets the owner stop the "life" without deleting |
| `archived` | Frozen, as for `paused` | Disabled | Owner-initiated; excluded from default listings; data retained; can return to `active` (the frozen interval is skipped and recorded like a resume) |

Only the owner can change the lifecycle state (`POST /v1/companions/:id/lifecycle`), and only to `active`, `paused` or `archived`.

"Dormant" is not a stored state and cannot be set by any client. The API may expose it as a read-only, derived field (`active` and not observed since a configured interval); the state catches up on the next access. This keeps one code path for the simulation and avoids a background scheduler.

Deletion is not a lifecycle state. It is performed by `DELETE /v1/companions/:id`, which runs the cascade below. While the cascade runs and afterwards, the API returns `410 Gone` (error code `gone`) to the owner and the same "not found" response as for a nonexistent ID to anyone else.

- **Creation.** Creating a character (from scratch or from an imported bundle) emits `character.created` with the initial state and a seed drawn from a cryptographically secure source and stored in world state (ADR-0002). No memories exist at creation, except owner-authored ones the owner enters explicitly.
- **Catch-up and the "while you were away" view.** Catch-up follows ADR-0002 (whole ticks, bounded window, skip event). The away summary required by #12 is a deterministic, read-only view computed from events since the owner's last session; it is not a memory unless the owner pins it (section 2, `summary`).
- **Export.** Export is an operation, not a state. A `CharacterBundle` (ADR-0003) never contains memories, conversations, world state, anchors or room maps by default. A memory export is a separate artifact (section 6). Exporting does not pause or alter the companion.
- **Import and identity.** Importing a bundle whose `character.id` does not exist on this server keeps the ID. If it exists, the import is rejected unless the owner chooses "import as copy", which assigns a new `chr_` ID and records `lineage.forkedFrom` with the original ID. Two servers may hold the same character ID with diverging state; global uniqueness and signed ownership are out of scope for v0.
- **Move.** Moving a companion to another device or server is export, import, then an explicit, separate delete on the origin. Nothing is deleted implicitly.
- **Deletion.** Owner-initiated, confirmed, and irreversible after completion. The cascade, in one transaction where the store allows:
  1. Mark the character as being deleted (an internal flag, not a lifecycle state) so that every route returns as described above; revoke all grants for the character and its memories; disable its object bindings (QR/NFC resolve to "not found or not permitted", never revealing prior existence to non-owners).
  2. Hard-delete all memory records, conversation records, summaries, derived indexes and embeddings for the character.
  3. If the world contains only this character (always true in M1), hard-delete the world, its event log, snapshots, anchors metadata and room data. If other characters remain (M4), rebase the world: write a new baseline snapshot that omits the deleted character, then hard-delete all events before the baseline. Replay is guaranteed from the latest baseline, not from genesis; this is the only operation allowed to move the baseline.
  4. Keep a content-free tombstone `{ id, kind: "character", deletedAt }` so that the ID is never reused and stale links fail cleanly.
  5. SQLite runs with `PRAGMA secure_delete = ON` for databases holding memory, so freed pages are overwritten. Files outside the database (exported archives the owner saved, OS backups) are outside the server's control; the UI must say so.

### 2. Memory types

| Type | Source | Producer | Trust for dialogue | Default retention |
| --- | --- | --- | --- | --- |
| `episodic` | One or more simulation events | Deterministic, versioned derivation rule in the Memory module | System-derived fact about simulated state | Until deleted; optional per-character cap with oldest-first eviction |
| `dialogue` | One or more conversation turns | Proposed by the dialogue provider, accepted by the deterministic memory policy (section 5) | Untrusted (model- and user-influenced) | Until deleted |
| `owner_authored` | Owner input | Owner via UI/API | Owner-provided data | Until deleted |
| `summary` | Other memories or an away-summary view | Deterministic template in M1; provider-generated later, with provenance | Inherits the lowest trust of its sources | Until deleted or invalidated by source deletion |

Conversation turns themselves are **conversation records**, owned by the Memory module but not memories. They form the short-term buffer for dialogue continuity. Default: the last 50 turns per character are persisted; older turns are hard-deleted. The owner can set the buffer to 0 (no transcript persistence). These defaults are proposals to validate with users; the mechanism (bounded buffer, owner control) is the decision.

Rules:

- The simulation never reads memories or conversation records. Memory cannot change simulation outcomes, so deleting memory cannot change replay.
- Simulation events carry only structured data (types, IDs, enumerated or bounded parameters). Free text from dialogue or models is never stored in event payloads; events reference conversation records by ID when needed (for example `intent.rejected` references the turn that proposed it). This keeps private text out of the authoritative log.
- Episodic derivation is a pure function `(event, ruleId, ruleVersion) -> memory | none`, run in the same transaction that appends the event. Its idempotency key is `(sourceEventId, ruleId)`. Content is template-generated, not model-generated.
- Owner edits to any memory set `editedAt` and keep the original provenance. An edited `dialogue` memory stays type `dialogue`; editing does not raise its trust level.

### 3. Memory record contract (`MemoryRecord` v0)

| Field | Meaning |
| --- | --- |
| `id` | `mem_` ID (ADR-0003) |
| `schemaVersion` | `"0.1.0"` |
| `characterId` | Owning character |
| `ownerId` | `usr_` of the character owner; the only principal with full control |
| `type` | `episodic` \| `dialogue` \| `owner_authored` \| `summary` |
| `content` | `{ text, data? }`; `text` bounded (proposed 1,000 characters); `data` is a schema-validated structured payload per type |
| `provenance.sourceKind` | `event` \| `conversation_turn` \| `owner` \| `memory` \| `import` |
| `provenance.sourceRefs` | IDs of source events, turns or memories (may later point to tombstones) |
| `provenance.producer` | `{ kind: "rule", ruleId, ruleVersion }` or `{ kind: "provider", providerId, providerVersion, model? }` or `{ kind: "owner" }` |
| `provenance.subjectUserIds` | Users whose interaction produced the memory; only the owner in M1 (see open question 1) |
| `provenance.importedFrom` | For imported memories: original memory ID and bundle/export ID |
| `createdAt`, `editedAt` | Wall-clock UTC timestamps |
| `simTime` | Simulated time the memory refers to, if any |
| `scope` | `private` (default) \| `invited`; `public` is rejected for memories (ADR-0003) |
| `pinned` | Owner flag used by retrieval ranking |
| `retention` | `{ policy: "until_deleted" \| "expires", expiresAt? }` |

A `MemoryTombstone` holds only `{ id, characterId, derivationKey?, deletedAt }` and never content.

### 4. Scopes and grants

- Every memory is `private` at creation, regardless of type or producer. No provider output, imported data or bulk action can create a non-private memory.
- Sharing a memory requires an explicit per-memory grant (`grant_`) by the owner naming the memory ID, the grantee and the permission: `view` (grantee may read it in the UI/API) and/or `use_in_dialogue` (it may be retrieved when the grantee talks to the character). Sharing a character never implies any memory grant (ADR-0003).
- Memories can never be `public` (ADR-0003: `public` grants access only to `chr_` profiles). Schemas reject `public` for memory and conversation records, and the access check denies it for `mem_` IDs even if such a value were stored. There is no bulk sharing of memories.
- Revocation is immediate: retrieval checks grants at request time; no cached context survives a revocation.
- Deleting a memory deletes its grants. Deleting a source memory deletes the `summary` memories derived from it; they may be re-derived without the deleted source, and tombstones prevent re-derivation of deleted episodic memories.

### 5. Retrieval and the dialogue boundary

Retrieval runs in the Memory module and produces an immutable context for one dialogue request:

1. Determine the session audience: the principals present in the conversation (only the owner in M1).
2. Candidate set: memories of this character that every audience member may use (`private` memories qualify only when the audience is exactly the owner; otherwise a `use_in_dialogue` grant for each member is required). This filter runs before ranking and before any index lookup.
3. Rank deterministically (pin, recency in simulated time, type weight, keyword overlap with the current turn; ties broken by ID) and truncate to a configured item and character budget.
4. Build `DialogueRequest.context.memories` as an array of frozen `MemoryContextItem { id, type, trust, text, simTime }`. Structured `data`, provenance internals, owner identity, anchors, room maps and location data are never included.

The `DialogueProvider` v1 (issue #13) receives this context as data only. It has no handle to the memory store, world store or network capabilities granted by the server. Its response may contain text, `IntentProposal`s (validated by the simulation validator, ADR-0002) and `MemoryProposal`s. A deterministic memory policy accepts a `MemoryProposal` only if it is type `dialogue`, has bounded text, references turns in the current session, stays within a per-session rate limit (proposed 5), and does not try to set scope, grants, pins or retention; accepted proposals are stored as `private` with provider provenance. Providers cannot edit or delete memories.

Prompt-injection considerations:

- Memory text is untrusted input to the model. Provider adapters must place memories in a delimited, labeled data section with their `type` and `trust`, separate from system instructions. This reduces but does not prevent injection; it is not relied on as a security control.
- The security control is capability limitation: whatever the model is persuaded to output, only allowlisted, state-legal intents execute, and memory proposals can only create private, bounded, provenance-tagged records the owner can inspect and delete. No model output can change scopes, grants, lifecycle state or provider configuration.
- Persistence of injected content (memory poisoning) is limited by the rate limit, the `dialogue` trust label, owner inspection and deletion, and by `summary` inheriting the lowest source trust.
- Context minimization: the scope filter guarantees that a friend's session never receives memories the friend is not granted, so an injection cannot exfiltrate them through the model.
- Sending memory context to a non-local provider is a user-data upload and requires an explicit, visible opt-in per provider (`CLAUDE.md`). The default provider is the local deterministic mock.
- Dialogue request contexts are not logged by default. Debug logging of contexts is opt-in, local and documented.

### 6. Memory export and import

- Owner-initiated memory export produces a separate artifact (`openkinverse.memory-export`, `schemaVersion` `0.1.0`) containing `MemoryRecord`s and, optionally, conversation records. It never contains tombstones, grants, anchors or room data. In M1 it is a plaintext JSON download with a clear warning; encryption of the export is decided with bundle archives in M2 (issue #18) before memories may travel with a bundle.
- `CharacterBundle.includes.memories` stays `false` in v0. Importing memories is a separate, explicit owner action; imported records keep their original provenance in `provenance.importedFrom`, become `private`, and are treated as untrusted `dialogue`-level trust regardless of their original type unless the importer is the same owner on the same server.

## Consequences

- Replay remains valid under memory deletion because the simulation is independent of memory and events contain no private free text. The one exception, character deletion in a multi-character world, is handled by an explicit baseline rebase.
- The Memory module owns three tables (memories, conversation records, tombstones) plus grants for memories; in M1 these live in the same SQLite database and transactions as the world store, behind a `MemoryStore` interface.
- Every dialogue request incurs a scope check and a deterministic ranking pass; at M1 volumes (hundreds of memories) this is negligible and can be measured in #17.
- Owners get inspect, edit, export and delete for every memory and conversation record. Deletion is irreversible; the UI must confirm and must state that previously exported files are outside its control.
- Derivation rule changes require a rule version bump; re-derivation is idempotent and respects tombstones.
- Semantic retrieval, encrypted memory export, crypto-shredding and multi-user memory ownership are deferred with explicit extension points rather than designed now.

### Acceptance criteria for implementation (#12, #13, #14, #17)

1. New memories of every type are `private`; a test attempts to create a non-private memory via provider proposal, import and bulk API and all are rejected.
2. Every stored memory has non-empty provenance; episodic memories reference existing source events and a rule ID and version.
3. Deleting a memory removes its content, grants and dependent summaries; a database inspection test finds no content; re-running derivation over the full event log does not recreate it.
4. Replaying a world's events after deleting any set of memories produces byte-identical world state (determinism test).
5. Deleting a character removes all its memories, conversation records, world events (single-character world) and grants; its QR/NFC binding resolves as not found for a non-owner.
6. A `DialogueProvider` mock asserting on its input receives only frozen context items within budget, and never receives anchors, room data, owner identity or memories outside the audience scope.
7. Provider `MemoryProposal`s that set scope, exceed the rate limit, exceed the text bound or reference turns outside the session are rejected and logged without content in the event log.
8. Pausing or archiving freezes simulated time; returning to `active` after a wall-clock gap produces no catch-up ticks for the frozen interval. A request to set `dormant` (or any value other than `active`, `paused`, `archived`) is rejected.
9. Memory export round-trips through import with provenance preserved and scope reset to `private`.
10. Creating or updating a memory or conversation record with scope `public` is rejected, and the access check denies `public` for `mem_` IDs.

## Risks

- **Derivation drift.** If episodic rules change, old and new memories may describe the same event differently. Mitigation: rule versioning, idempotency keys, optional re-derivation job.
- **Owner expectation of deletion vs files outside the server.** Mitigation: explicit UI copy; crypto-shredding when remote backups exist.
- **Prompt injection remains possible** in the text a character says. Mitigation: capability limits are the control; text output is presented as simulated character speech; moderation for public characters is an M3 concern.
- **SQLite freed pages and WAL files.** `secure_delete` overwrites freed pages, but WAL contents persist until checkpoint. Mitigation: checkpoint after deletion cascades; verify in #17 tests rather than assuming.
- **Default retention numbers (50 turns, 1,000 characters, 5 proposals per session) are unvalidated assumptions.** They are configuration, not contract.

## Open questions

1. **Memories from non-owner interactions (M3).** When a friend talks to a shared character, the resulting memories contain the friend's personal data but belong to the owner's character. Proposed direction: the friend is a `subjectUserId`, is told at session start that the character retains memories visible to its owner, and can list and delete memories where they are a subject. Requires a separate ADR with `security-privacy-reviewer` input before #22 ships.
2. **Encrypted memory export format** (M2, issue #18): algorithm, key handling and whether the export can be imported by another owner.
3. **Account deletion** (M3, issue #21): cascades over all owned characters using the character deletion procedure above.

## Evidence

- No code exists yet; this ADR is a design proposal. No benchmark or device result is claimed.
- Verified facts: the issue acceptance criteria for #12, #13, #17 and #29 were read from GitHub on 2026-11-15. SQLite documents `PRAGMA secure_delete` and its interaction with WAL in its official pragma documentation; behavior in `node:sqlite` on Node.js 24 is not yet verified for this project and is part of #17.
- Assumptions: memory volumes in M1 are small (hundreds of records per character); retention defaults are placeholders pending user feedback.

# Architecture principles (initial proposal)

## Start as a modular monolith

Keep domain modules separately testable and deployable, but avoid premature microservices. Split out GPU workers or realtime gateways only when workload/latency/scale requires them.

## Proposed bounded contexts

- Identity & Access: users, devices, invitations, friends, roles and sharing scopes.
- Character: identity, profile, personality, assets, behavior packs and portable bundle.
- World: homes, rooms, object catalog, room graph, spatial anchors and relocalization metadata.
- Simulation: needs, schedule, state transitions, activities, navigation and event log.
- Companion Runtime: dialogue, intent generation, tool selection and validated actions.
- Memory: private memories, shared memories, provenance, retention and deletion.
- Providers: versioned adapters for LLM, speech, vision, image/3D/video generation and storage.
- Social: share links, friend access, public discovery and moderation controls.
- Rendering/AR: camera passthrough, 3D rendering, hand tracking, depth and occlusion.

## Critical separation

1. The world simulation owns authoritative character/world state.
2. LLMs propose intents; deterministic policy validates and executes them.
3. The AR client visualizes state and submits user interactions; it does not own canonical state.
4. Memory is not the same as event history. Store provenance and allow users to inspect, export and delete it.
5. Character bundles are portable; private memories and location maps are excluded by default.

## Portability model

Design a versioned `CharacterBundle` manifest with stable IDs, semantic version, schema version, asset references, rig/animation metadata, behavior configuration, compatible provider requirements, license/provenance records and optional separately encrypted memory export.

## Physical object binding

Support several adapters: QR/deep link for identity lookup, NFC for tap-to-resolve, image targets/AprilTags for visual tracking, and ARKit/ARCore spatial anchors for room-relative pose. Do not treat QR as a replacement for SLAM or spatial tracking.

## Sharing and privacy

Use explicit ACLs and scoped grants. `private`, `invited`, `public` are distinct. A friend may be allowed to view/interact with a shared character without getting the owner's private memories, home scan, anchor map or conversation archive. Provide revoke, export and deletion.

## Reliability

- Version every provider interface and data schema.
- Use idempotency keys for generation jobs and world actions.
- Store simulation events so state can be replayed or audited.
- Make background jobs observable and retryable.
- Test without paid APIs using deterministic mocks.
- Keep external inference optional.

## Decisions still open

The first ADR must settle platform/runtime choice (e.g. Unity vs native ARKit/ARCore vs a Godot-based experiment), server language, database, realtime transport and first target OS. Prove device support with a small spike before committing to a full cross-platform strategy.

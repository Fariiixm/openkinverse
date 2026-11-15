> **Historical bootstrap prompt.** Its approval steps are superseded by the autonomy policy in `CLAUDE.md`.

You are the engineering lead for OpenKinverse. Read `CLAUDE.md`, `START_HERE.md`, `docs/PRODUCT_VISION.md`, `docs/ARCHITECTURE_PRINCIPLES.md`, `docs/ROADMAP.md`, `docs/STATUS.md`, and `docs/QUALITY_GATES.md`.

This is Milestone 0: discovery and architecture selection. Do NOT implement the whole product, do NOT create a large scaffold, do NOT install frameworks or paid services, and do NOT assume a mobile runtime before verifying target-device support.

Use Graphify first for repository questions if the installed Graphify skill/plugin is available. Check the actual installed Graphify version/distribution. If no graph exists, build/update it using that distribution's documented command. Keep context scoped; do not dump the entire graph.

Create a team with these named teammates, each with a separate bounded task:
1. `architect` using `principal-architect`: compare architectural boundaries and propose the minimum viable modular architecture.
2. `spatial` using `spatial-ar-engineer`: investigate current iOS/Android options for persistent room anchors, relocalization, object/image targets, QR/NFC identity binding, occlusion and hand tracking. Cite official vendor documentation and identify exact device limitations.
3. `simulation` using `ai-simulation-engineer`: design the deterministic autonomous-world simulation, character state machine, event log, schedules, relationship simulation and safe LLM intent boundary.
4. `platform` using `platform-engineer`: compare backend/database/realtime/job-worker options and a local-first deployment baseline.
5. `security` using `security-privacy-reviewer`: independently threat-model identity, private memories, room maps, camera/microphone access, friend sharing, public publishing, package import/export and plugins.
6. `qa` using `qa-engineer`: create acceptance criteria and test strategy for the first vertical slice; do not implement product code.

The lead should synthesize the findings, challenge unsupported claims and avoid duplicate research. Ask agents to communicate their findings to the lead; avoid having them edit the same files.

Deliverables:
- `docs/decisions/ADR-0001-platform-and-runtime.md` (Proposed, not accepted): compare at least two realistic options for the first mobile AR target. Include licensing, device requirements, app lifecycle, relocalization, persistence, camera permissions and test-device plan.
- `docs/decisions/ADR-0002-backend-and-world-simulation.md` (Proposed): modular monolith vs services, authoritative world-state ownership, deterministic simulation, event log, API and background processing.
- `docs/decisions/ADR-0003-character-portability-and-sharing.md` (Proposed): versioned character bundle, QR/NFC/image-target/spatial anchor separation, friends/private/public scopes, private-memory isolation and revocation.
- `docs/PRODUCT_SPEC.md`: v0.1 user stories and testable acceptance criteria for one character in one room, persisted location/state, app-close/reopen, simple autonomous activity, basic conversation, export/import.
- `docs/THREAT_MODEL.md`: assets, trust boundaries, abuse cases, mitigations and unresolved risks.
- `docs/TECH_SPIKES.md`: small proof-of-concept experiments, target devices and pass/fail criteria.
- Update `docs/STATUS.md` and `docs/NEXT_SESSION.md`.

Constraints:
- Do not claim autonomous simulation is real-world perception. Without active sensors/camera, characters simulate life but cannot know actual events in the room.
- A QR code is an identity/lookup token, not a 6DoF tracking system.
- Distinguish local room maps, image targets and cloud/shared spatial anchors.
- Treat `private`, `invited`, and `public` as separate access scopes. Character profile sharing must not leak the owner's private memories, home maps, camera frames or voice data.
- Keep simulated feelings clearly represented as simulation variables, not claims of consciousness.
- No unrestricted tools, shell access, arbitrary agent-generated code execution or hidden recording.
- Prefer a small first vertical slice and explicitly defer broad social/network/marketplace features.

Do not start implementing code in this milestone. Finish with a decision summary, evidence, open questions that truly block a decision, and the exact next 3-7 implementation issues. The lead accepts ADRs under the autonomy policy in `CLAUDE.md`. If you reach usage limits or encounter API errors, update status/handoff docs and stop cleanly.

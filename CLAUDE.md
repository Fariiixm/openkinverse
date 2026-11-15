# OpenKinverse — instructions for Claude Code

## Mission
Build OpenKinverse: an open-source, provider-neutral platform for persistent, portable, autonomous AI companions anchored in real and virtual spaces. The current milestone is a small, verifiable vertical slice, not the entire long-term vision.

## Language
- Communicate with the repository owner in Spanish unless asked otherwise.
- Write everything stored in the repository or on GitHub in professional English: source code, identifiers, comments, technical documentation, ADRs, issues, pull requests, review comments and commit messages.
- Do not mix languages in repository artifacts. Translate owner requests given in Spanish into English before recording them in issues, docs or commits.

## Before every non-trivial task
1. Read `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE_PRINCIPLES.md`, and `docs/STATUS.md` (create STATUS if absent).
2. For codebase questions, follow the `graph-first` skill: use Graphify (a `/graphify` skill/command or `graphify` CLI) if it is installed; otherwise state that it is unavailable and use scoped Grep/Glob. Do not assume which Graphify distribution is installed, and do not install one without owner approval.
3. Use the graph (or search results) to locate relevant concepts, then read the actual source files before changing them. The graph is a navigation aid, not source of truth. If stale or missing, say so and rebuild/update it using the installed version's documented command.
4. Read relevant ADRs in `docs/decisions/` and the linked GitHub issue/acceptance criteria.
5. If architecture, API, data model, security, privacy, portability or compatibility changes, propose an ADR before implementation.

## Engineering rules
- Prefer a modular monolith and explicit module boundaries until measured scale justifies services.
- Never invent functionality, test results, benchmark results, API availability or compatibility claims.
- Never silently add a paid API, external service, telemetry, analytics or user-data upload.
- Provider integrations must be behind typed, versioned interfaces and have a local/mock test path.
- Keep deterministic simulation (world state, movement, needs, schedule, relationship scores) separate from probabilistic LLM output.
- LLMs may propose structured intents; deterministic validators decide whether an action is legal and execute it. Never execute model-generated shell commands or arbitrary code from character agents.
- Spatial anchors, room maps, QR/image targets, object identity and character identity must be separate concepts. QR codes may identify a portable object/character; they do not by themselves provide six-degree-of-freedom tracking.
- Use explicit sharing scopes: `private`, `invited`, `public`. Deny by default. Memories, room scans, camera frames, voice recordings and location history are private unless the owner explicitly shares them.
- Do not imply characters are conscious or have actual feelings. Simulated needs, moods and relationships must be described as simulation state.
- Require permission and explicit user control for camera, microphone, sensors, cloud inference and sharing.
- Add tests for changed behavior. Do not claim success until commands actually pass.
- Never commit secrets, tokens, user-generated private data, generated caches, local room maps, camera frames or downloaded model weights.

## Git discipline
- Never push directly to `main`.
- Work on one issue per branch: `feat/123-short-name`, `fix/123-short-name`, `docs/123-short-name`, `chore/123-short-name`.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `build:`, `ci:`.
- Do not rewrite shared history or force-push unless the owner explicitly approves.
- Before finishing: inspect `git diff`, run relevant format/lint/typecheck/tests, summarize evidence, risks and follow-up work.
- Create a PR-ready change; do not merge or publish a release without owner approval.

## Agent collaboration
- The main Claude session is the engineering lead and integrator.
- Delegate only bounded tasks with file ownership and acceptance criteria.
- Avoid parallel edits to the same files. Ask the lead before changing shared schemas, migrations, API contracts or dependency manifests.
- QA and security agents review independently and should not silently rewrite the implementation.
- If blocked by usage limits, API errors, permissions or missing credentials, save state in `docs/STATUS.md` and `docs/NEXT_SESSION.md`, then stop cleanly. Never pretend to work in the background or loop indefinitely.

## Definition of Done
A task is done only when:
1. Acceptance criteria are satisfied or explicitly marked blocked.
2. Tests and checks for the changed area pass (or failures are recorded honestly).
3. No secrets/private user data are included.
4. Public interfaces and docs are updated where needed.
5. A reviewer has inspected the diff.
6. `docs/STATUS.md` and `docs/NEXT_SESSION.md` reflect the current state.

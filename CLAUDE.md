# OpenKinverse — instructions for Claude Code

## Mission
Build OpenKinverse: an open-source, provider-neutral platform for persistent, portable, autonomous AI companions anchored in real and virtual spaces. Deliver the complete product vision in `docs/PRODUCT_VISION.md` through small, verifiable, tested increments. Foundations or an MVP do not make the project complete.

## Operating model (autonomous engineering organization)
The repository owner is the founder and product owner. The owner has delegated all routine engineering work to the agent organization led by the main Claude session. Full autonomy is explicitly authorized.

- The lead owns the backlog, priorities, architecture decisions, implementation, reviews, merges, CI, releases, milestones and documentation.
- Do not ask the owner whether to create branches or issues, implement a feature, commit, push, open or merge a pull request, fix failing tests, update documentation or continue with the next task.
- Work loop: select the highest-priority open backlog issue → implement on an issue branch → validate → commit and push → open a PR → obtain independent agent review and green automated checks → merge → update `docs/STATUS.md` → select the next issue.
- Keep a prioritized GitHub backlog (labels `priority:P0`–`priority:P3`, milestones M0–M5). Add issues for discovered work instead of silently widening scope.
- Escalate to the owner only for genuine blockers: actions requiring the owner's account authentication or token permissions, owner-only repository/organization settings, unavoidable paid expenditure, or a product decision that cannot be inferred safely from the product vision. When blocked, record the blocker precisely (exact permission or decision needed), continue all independent work, and report it.
- A session has finite context and usage. Before stopping, save state with the `handoff` skill. Never pretend to work in the background or loop indefinitely.

## Language
- Communicate with the owner in Spanish unless asked otherwise.
- Write everything stored in the repository or on GitHub in professional English: source code, identifiers, comments, documentation, ADRs, issues, pull requests, review comments, CI configuration, release notes, agent-to-agent communication and commit messages.
- Do not mix languages in repository artifacts. Translate owner requests given in Spanish into English before recording them.

## Before every non-trivial task
1. Read `docs/STATUS.md`, `docs/NEXT_SESSION.md`, and the relevant parts of `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md` and `docs/ARCHITECTURE_PRINCIPLES.md`.
2. For codebase and architecture questions, follow the `graph-first` skill. When `graphify-out/graph.json` exists, run `graphify query "<question>"` (or `graphify path "A" "B"`, `graphify explain "X"`, `graphify section "<heading>"`) before the first Grep, search or source-file read. In a fresh worktree or checkout, run `graphify update .` first to build the graph. Use `graphify-out/GRAPH_REPORT.md` only for broad architecture reviews. Without Graphify, state that it is unavailable and use scoped Grep/Glob.
3. Read the actual source files before changing them. A graph or search result is a navigation aid, not source of truth. After changing code, run `graphify update .` (AST-only, local, no API cost); the installed git hooks also do this after commits and checkouts.
4. Include the graph-first rule in every subagent prompt that explores code.
5. Read relevant ADRs in `docs/decisions/` and the linked GitHub issue and acceptance criteria.
6. If architecture, public API, data model, security, privacy, portability or compatibility changes, write or update an ADR before or with the implementation. The lead accepts ADRs after `principal-architect` input and, for security- or privacy-relevant decisions, `security-privacy-reviewer` input. The owner may override any ADR at any time.

## Engineering rules
- Prefer a modular monolith and explicit module boundaries until measured scale justifies services.
- Never invent functionality, test results, benchmark results, API availability or compatibility claims.
- Never silently add a paid API, external service, telemetry, analytics or user-data upload. Adding any of these is an owner escalation. This includes Graphify semantic extraction or community labeling through remote LLM backends (for example Gemini or OpenAI API keys); only local AST updates are allowed by default.
- Provider integrations must be behind typed, versioned interfaces and have a local/mock test path.
- Keep deterministic simulation (world state, movement, needs, schedule, relationship scores) separate from probabilistic LLM output.
- LLMs may propose structured intents; deterministic validators decide whether an action is legal and execute it. Never execute model-generated shell commands or arbitrary code from character agents.
- Spatial anchors, room maps, QR/image targets, object identity and character identity are separate concepts. QR codes and NFC tags may identify a portable object or character; they do not by themselves provide six-degree-of-freedom tracking.
- Use explicit sharing scopes: `private`, `invited`, `public`. Deny by default. Memories, room scans, camera frames, voice recordings and location history are private unless the owner explicitly shares them.
- Do not imply characters are conscious or have actual feelings. Simulated needs, moods and relationships are described as simulation state.
- Require permission and explicit user control for camera, microphone, sensors, cloud inference and sharing.
- Add tests for changed behavior. Do not claim success until commands actually pass.
- Never commit secrets, tokens, user-generated private data, generated caches, local room maps, camera frames or downloaded model weights.

## Git and GitHub discipline
- Never push directly to `main`, never force-push shared branches, never rewrite shared history, and never bypass or disable required checks.
- One issue per branch: `feat/123-short-name`, `fix/123-short-name`, `docs/123-short-name`, `chore/123-short-name`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `build:`, `ci:`. Messages describe the actual change.
- Attribution: keep the real Git author identity configured on the machine and never fabricate authorship. Do not add `Co-Authored-By` AI trailers, "Generated with" footers or other promotional attribution; Claude Code attribution is disabled in `.claude/settings.json`. Commit and PR descriptions state accurately what changed.
- Do not use emojis in repository content, commits, issues, pull requests or technical communication.
- Merge policy: squash-merge a PR only when (a) all CI checks are green, (b) at least one independent agent review (`qa-engineer`, plus `security-privacy-reviewer` for sensitive changes listed in `docs/QUALITY_GATES.md`) reports no unresolved blocker or major finding, and (c) the PR body records commands run and real results. Until CI exists (issue #3), the PR body must list the local checks that were run, and the independent agent review is mandatory. Use GitHub auto-merge when the repository allows it; otherwise merge only after `gh pr checks` reports success. Never use `gh pr merge --auto` when auto-merge is disabled, because it merges immediately.
- Before merging: inspect the full diff, run the relevant checks locally, and confirm no secrets or private data are included.

## Agent collaboration
- The main Claude session is the engineering lead and integrator.
- Delegate bounded tasks with file ownership and acceptance criteria. Avoid parallel edits to the same files.
- Specialists change shared schemas, migrations, API contracts or dependency manifests only when the lead assigns that change.
- QA and security agents review independently and do not rewrite the implementation they review. An agent never reviews its own work.

## Definition of Done
A task is done only when:
1. Acceptance criteria are satisfied or explicitly marked blocked.
2. Tests and checks for the changed area pass (or failures are recorded honestly).
3. No secrets or private user data are included.
4. Public interfaces and docs are updated where needed.
5. An independent agent reviewer has inspected the diff and CI is green.
6. `docs/STATUS.md` and `docs/NEXT_SESSION.md` reflect the current state.

The product is done only when every capability in `docs/PRODUCT_VISION.md` meets the release checklist in `docs/QUALITY_GATES.md`.

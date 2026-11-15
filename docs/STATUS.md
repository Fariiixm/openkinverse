# Project status

- Current phase: 0 — Project foundation.
- Current milestone: repository bootstrap and technical discovery.
- Current vertical slice: not implemented.
- Decisions accepted: none yet; proposals in `docs/ARCHITECTURE_PRINCIPLES.md` are not final.
- Blockers: confirm project name/owner, operating system, target phone(s), AR runtime and Graphify distribution/version.
- Latest verified checks: none for product code (source tree not scaffolded yet). Configuration checks on branch `chore/initial-project-fixes`: settings JSON parses, status-line script runs with `py`.
- In progress: branch `chore/initial-project-fixes` (status-line command, permission rules, Graphify fallback, ADR template numbering, agent boundaries, language policy). Committed locally; not pushed; no PR opened yet.
- Tooling gaps: Graphify not installed (skills fall back to Grep/Glob); GitHub CLI `gh` not installed; GitHub branch protection for `main` not verified.
- Last updated: 2026-11-15.

## Next actions

1. Create the GitHub repository and add this starter kit.
2. Run the first Claude Code discovery session.
3. Ask architect and spatial agents to compare AR platform options on target devices.
4. Write and accept ADR-0001 (platform and runtime; not yet written) before scaffolding production code. The template is `docs/decisions/ADR-0000-template.md`.

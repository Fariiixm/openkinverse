---
name: graph-first
description: Use Graphify as the first navigation step for architecture and codebase questions to reduce broad file reads and keep context scoped. Falls back to scoped Grep/Glob when Graphify is unavailable.
---
# Graph-first repository exploration

The project uses Graphify (`graphifyy` 0.9.111, CLI `graphify`). See `docs/TOOLING.md` for installation and policy.

0. Check availability: `graphify --version`. If the command is missing, state once: "Graphify unavailable; using Grep/Glob fallback." and follow the fallback below. Never block the task on Graphify.
1. Make sure the graph exists and is current. `graphify-out/` is a local, git-ignored artifact, so a fresh clone or agent worktree has no graph: run `graphify update .` (local AST extraction, no LLM, no network). Run it again after changing code. In the main checkout, git hooks installed with `graphify hook install` refresh it after commits, merges and checkouts.
2. Ask the narrowest question possible:
   - `graphify query "<question>"` for where something lives and what it relates to.
   - `graphify path "<A>" "<B>"` for a dependency or relationship between two concepts.
   - `graphify explain "<concept>"` for a node and its neighbors.
   - `graphify section "<heading>"` to print a Markdown section without opening the file.
   - `graphify-out/GRAPH_REPORT.md` only for broad architecture reviews.
3. Open only the source files and line ranges the graph identifies, then verify the implementation in the actual files. Graph edges can be inferred or stale.
4. If graph output conflicts with source, source wins: run `graphify update .` and report the discrepancy.
5. Do not run semantic extraction or community labeling with remote LLM backends (`graphify label`, `--backend`, API keys). That uploads repository content to a third party and requires owner escalation.
6. Never paste the complete graph or report into the main context. Return a short summary, key paths and confidence.

## Fallback without Graphify

1. Use Glob with narrow patterns to locate candidate files (module directories, file names, extensions).
2. Use Grep for specific identifiers, types, routes or config keys, scoped to the candidate directories. Prefer `files_with_matches` first, then `content` with limited context.
3. Read only the files that the search identifies as relevant.
4. Never search or read secrets, `.env` files, user data, room maps, camera media, voice recordings or model weights.
5. Report the key paths found and note that results come from text search, so indirect dependencies may be missed.

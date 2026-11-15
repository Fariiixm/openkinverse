# Developer and agent tooling

## Graphify (code graph navigation)

Status: **not installed**. Agents use the scoped Grep/Glob fallback defined in `.claude/skills/graph-first/SKILL.md`.

Reasons:
- Several unrelated projects and packages use the name "Graphify". None was preinstalled on the development machine (`graphify --version` fails; no `/graphify` skill is registered).
- Installing a third-party package that reads the entire repository is a supply-chain decision. It requires verifying the exact distribution, maintainer, license and data handling (it must not upload source code to a remote service).
- The codebase is still small enough that scoped text search is effective.

Revisit when the repository exceeds roughly 200 source files, or when a distribution with verified provenance, an OSI-approved license and fully local operation is identified. Record the choice here and in `START_HERE.md` before installing it.

## GitHub CLI

`gh` is installed and authenticated with a fine-grained personal access token. Known permission gaps are tracked in `docs/STATUS.md`.

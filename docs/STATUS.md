# Project status

- Current phase: 0 — Project foundation (milestone **M0 Foundation**).
- Operating model: autonomous engineering organization (see `CLAUDE.md`). Backlog: GitHub issues #2–#26, prioritized with `priority:P0`–`P3` labels and milestones M0–M5.
- Current vertical slice: not implemented.
- Decisions accepted: none yet. ADR-0001 to ADR-0003 are tracked by issues #5–#7.
- Last updated: 2026-11-15.

## History

- PR #1 (`chore/initial-project-fixes`) was squash-merged into `main` as `9000b4e` on 2026-11-15 **without review**. `gh pr merge --auto` merged it immediately because auto-merge is disabled on the repository and `main` has no required checks. The content matched the reviewed local commit and contained no secrets. The merge policy in `CLAUDE.md` now forbids `--auto` while auto-merge is disabled.

## Blockers requiring the owner

1. **Repository administration permission.** The `gh` fine-grained token returns HTTP 403 for repository settings, branch protection and rulesets. Grant the token the repository permission **Administration: Read and write** (or apply the settings in issue #4 manually). Until then: no branch protection on `main`, auto-merge disabled, merge commits allowed.
2. Resolved 2026-11-15: the owner removed the routine `ask` rules (checkout/switch main, commit, push, merge, rebase) from `.claude/settings.json` via `/permissions`. Only `git reset --hard` still asks. Claude Code attribution is disabled in the same file.

## Latest verified checks

- None for product code (source tree not scaffolded yet).

## Tooling

- Graphify: `graphifyy` 0.9.111 installed by the owner (2026-11-15). Graph is a local, git-ignored artifact rebuilt with `graphify update .` and by local git hooks; CI builds it in the `graph` workflow. See `docs/TOOLING.md`.
- GitHub CLI: installed and authenticated; issue and PR operations work; settings operations return 403.
- Agent team (2026-11-15): devops (#8, #3), backend (#10), simulation (#11), architect (#29, PR #32; reviewed PR #28 with changes requested), qa (#30, PR #31). Agents work in isolated git worktrees under `.claude/worktrees/` (git-ignored).

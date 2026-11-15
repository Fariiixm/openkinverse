# Branch and release model

- `main`: always releasable; protected; PR-only.
- `feat/<issue>-<slug>`: feature work.
- `fix/<issue>-<slug>`: bug fixes.
- `docs/<issue>-<slug>`: documentation-only changes.
- `chore/<issue>-<slug>`: tooling, dependencies and maintenance.

Use short-lived branches. Require green CI before merge. Use squash merge only. Tag releases with SemVer once public interfaces exist. Agents never push to `main`, never force-push shared branches and never bypass required checks. Agents merge PRs after CI passes and an independent agent review reports no blocker or major finding (see `CLAUDE.md`). Releases are published only through gated workflows.

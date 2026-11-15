# Branch and release model

- `main`: always releasable; protected; PR-only.
- `feat/<issue>-<slug>`: feature work.
- `fix/<issue>-<slug>`: bug fixes.
- `docs/<issue>-<slug>`: documentation-only changes.
- `chore/<issue>-<slug>`: tooling, dependencies and maintenance.

Use short-lived branches. Require CI checks before merge. Use squash merge or rebase consistently (maintainer chooses). Tag releases with SemVer once public interfaces exist. Never let agents force-push, merge their own PR, or publish packages/releases without explicit maintainer approval.

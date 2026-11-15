---
name: handoff
description: Saves a compact, durable project handoff before a context limit, rate limit, error, interruption or end of work session.
---
# Safe handoff

1. Record current branch and `git status`.
2. Summarize the current milestone and exact in-progress issue.
3. List completed work, files changed and commits created.
4. List tests actually run and their results.
5. List blockers, failed commands, assumptions and decisions still awaiting owner approval.
6. Write the next 3-7 concrete actions in `docs/NEXT_SESSION.md`.
7. Update `docs/STATUS.md` with current phase, milestone, blockers and last verified checks.
8. Do not commit secrets, local logs, transcripts or private data. Do not create a misleading "done" state.

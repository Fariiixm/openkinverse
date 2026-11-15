---
name: implement-issue
description: Implements one scoped GitHub issue end-to-end with tests, documentation, traceability and a clean handoff.
---
# Issue implementation workflow

1. Read CLAUDE.md, docs/STATUS.md, docs/NEXT_SESSION.md, the issue and relevant ADRs.
2. Follow the `graph-first` skill (Graphify if available, otherwise scoped Grep/Glob); then inspect the actual relevant source files.
3. Confirm scope, acceptance criteria, owner files and dependencies. If unclear, record assumptions in the issue and derive requirements from the product vision; escalate to the owner only for genuine blockers.
4. Create/use the issue branch. Do not commit to `main`.
5. Implement the smallest vertical change. Preserve module boundaries and provider interfaces.
6. Add or update tests. Include negative, permission, persistence/restart and failure-path tests where relevant.
7. Run format, lint, typecheck, tests and build for touched packages. Capture actual output.
8. Inspect the complete diff for secrets, private data, accidental generated files and unrelated changes.
9. Update API docs, ADRs, examples, CHANGELOG or migration notes where necessary.
10. Commit, push and open a PR with commands run and real results.
11. Obtain an independent agent review and green CI, address blocker/major findings, then squash-merge following the merge policy in CLAUDE.md.
12. Update docs/STATUS.md, close the issue and continue with the next backlog item.

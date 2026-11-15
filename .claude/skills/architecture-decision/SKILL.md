---
name: architecture-decision
description: Creates or reviews an Architecture Decision Record for changes affecting modules, APIs, data models, providers, spatial persistence, sharing, privacy or compatibility.
---
# Architecture decision workflow

1. Read the product vision, architecture principles, roadmap, current status and relevant existing ADRs.
2. Query Graphify first if the decision touches existing code.
3. State the decision, constraints, non-goals and acceptance criteria.
4. Compare at least two viable options using device support, maturity, licensing, privacy, latency, cost, operational burden and migration path.
5. Separate verified facts, assumptions and unknowns; cite primary documentation in the ADR.
6. Recommend one option and explain consequences and rollback/migration approach.
7. Save as `docs/decisions/ADR-NNNN-short-title.md` with status `Proposed` until the maintainer approves it.
8. Do not implement an unapproved architectural change unless the owner explicitly requests a spike.

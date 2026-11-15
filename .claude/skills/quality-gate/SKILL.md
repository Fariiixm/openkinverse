---
name: quality-gate
description: Performs a pre-PR quality review and blocks claims of completion unless evidence meets the project's Definition of Done.
---
# Quality gate

1. Read issue acceptance criteria and inspect the full diff.
2. Query Graphify first for impacted dependency paths when a graph exists.
3. Run the relevant format, lint, typecheck, unit, integration and build commands.
4. Inspect secrets, permissions, dependency licenses, generated files and user-data exposure.
5. Validate API/schema compatibility and migration safety where relevant.
6. Produce a report: PASS/FAIL/BLOCKED for each criterion, commands executed, evidence, findings by severity, and untested assumptions.
7. If a check cannot run, say why. Never silently waive a failed check.

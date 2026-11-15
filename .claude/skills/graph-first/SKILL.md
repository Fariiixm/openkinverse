---
name: graph-first
description: Use Graphify as the first navigation step for architecture and codebase questions to reduce broad file reads and keep context scoped.
---
# Graph-first repository exploration

1. Detect the installed Graphify distribution and version (`graphify --help`, `graphify --version`, or the available `/graphify` skill). Do not install a different distribution blindly; multiple projects use the Graphify name.
2. If no graph exists, build it with the installed tool's documented command. Exclude generated folders, build outputs, dependency directories, secrets, user data, camera media, room maps and model weights.
3. For a question, issue the narrowest graph query possible. Use path/explain commands where supported.
4. Open only source files that the graph identifies as relevant, then verify the implementation in the actual files. Graph edges can be inferred or stale.
5. If graph output conflicts with source, source wins; refresh the graph and report the discrepancy.
6. After substantial structural changes, update the graph and verify changed-file coverage.
7. Never paste the complete graph or report into the main context unless necessary. Return a short summary, key paths and confidence/ambiguity.

---
name: graph-first
description: Use Graphify as the first navigation step for architecture and codebase questions to reduce broad file reads and keep context scoped. Falls back to scoped Grep/Glob when Graphify is unavailable.
---
# Graph-first repository exploration

0. Check availability. If no Graphify CLI (`graphify --version`) or `/graphify` skill is found, or no graph exists and it cannot be built with an installed tool, state once in your report: "Graphify unavailable; using Grep/Glob fallback." Then follow the fallback below. Do not install Graphify or any other tool without owner approval, and do not block the task.
1. Detect the installed Graphify distribution and version (`graphify --help`, `graphify --version`, or the available `/graphify` skill). Do not install a different distribution blindly; multiple projects use the Graphify name.
2. If no graph exists, build it with the installed tool's documented command. Exclude generated folders, build outputs, dependency directories, secrets, user data, camera media, room maps and model weights.
3. For a question, issue the narrowest graph query possible. Use path/explain commands where supported.
4. Open only source files that the graph identifies as relevant, then verify the implementation in the actual files. Graph edges can be inferred or stale.
5. If graph output conflicts with source, source wins; refresh the graph and report the discrepancy.
6. After substantial structural changes, update the graph and verify changed-file coverage.
7. Never paste the complete graph or report into the main context unless necessary. Return a short summary, key paths and confidence/ambiguity.

## Fallback without Graphify

1. Use Glob with narrow patterns to locate candidate files (module directories, file names, extensions).
2. Use Grep for specific identifiers, types, routes or config keys, scoped to the candidate directories. Prefer `files_with_matches` first, then `content` with limited context.
3. Read only the files that the search identifies as relevant.
4. Never search or read secrets, `.env` files, user data, room maps, camera media, voice recordings or model weights.
5. Report the key paths found and note that results come from text search, so indirect dependencies may be missed.

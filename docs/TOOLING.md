# Developer and agent tooling

## Graphify (code and documentation graph)

Status: **installed** by the owner on 2026-11-15.

- Distribution: [`graphifyy`](https://pypi.org/project/graphifyy/) 0.9.111 on PyPI, CLI `graphify`, installed with `uv tool install graphifyy==0.9.111`.
- Project integration: `.claude/skills/graphify/` (skill installed by `graphify install`), PreToolUse/SessionStart `graphify hook-guard` hooks in `.claude/settings.json`, and the `graph-first` skill.

### What is committed

| Path | Committed | Reason |
| --- | --- | --- |
| `.claude/skills/graphify/` | Yes | Lets every Claude Code session and agent worktree use `/graphify`. |
| `.claude/settings.json` hooks | Yes | Graph-first reminders before searches and reads. Hooks only add context; a missing `graphify` binary produces a non-blocking hook error. |
| `graphify-out/` | No (git-ignored) | Rebuilt whole on every run, contains absolute local paths and caches. Regenerate locally. |
| `*.graphify-bak` | No | Installer backups. |
| `.claude/agent-memory/`, `.claude/worktrees/` | No | Private local agent state and worktrees; also excluded from the graph. |

### Keeping the graph current

- Main checkout: `graphify hook install` installs post-commit, post-checkout, post-merge and post-rewrite hooks in `.git/hooks` that run AST-only updates. These hooks are local and not versioned; run the command once per clone.
- Agent worktrees and fresh clones: run `graphify update .` before the first query and after code changes.
- After a refactor that deletes code: `graphify update . --force`.
- Documentation-only changes are covered by `graphify update .` as well (Markdown sections are extracted locally).
- CI: the `graph` workflow installs the pinned version, builds the graph with `graphify update .`, runs a smoke query and uploads `graphify-out/` as a short-lived build artifact. It fails if the graph cannot be built.

### Policy

- Only local AST extraction is allowed by default. Remote LLM backends for semantic extraction or community labeling (`graphify label`, `--backend`, `GEMINI_API_KEY`, `OPENAI_API_KEY` and similar) upload repository content to third parties and require owner approval.
- Do not run `graphify add <url>`, `graphify clone` or watch mode in CI.

## GitHub CLI

`gh` is installed and authenticated with a fine-grained personal access token. Known permission gaps are tracked in `docs/STATUS.md`.

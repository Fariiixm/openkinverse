# Claude Code status line

The optional script `statusline.py` displays current model, context-window use, and plan usage windows when Claude Code exposes them. It can send a local desktop notification at 80% and 90% thresholds.

1. Ensure Python 3 is installed.
2. Copy `.claude/statusline.py` into `.claude/` (or keep it there in the repository).
3. Run `/statusline` and ask Claude Code to display model, context-window percentage, 5-hour/7-day usage and spend percentage if available. Alternatively configure the script in your user `~/.claude/settings.json`.
4. For a repository-relative command use `python3 .claude/statusline.py` on macOS/Linux. On Windows, use `py .claude/statusline.py` if `python3` is not on PATH.

Important: context-window percentage is not the same as account quota. `rate_limits` fields may be absent depending on plan/authentication/gateway. The script cannot guarantee advance notice of a hard limit or prevent a quota reset. It only alerts when Claude Code supplies the relevant status data on a status-line refresh.

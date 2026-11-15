# Claude Code status line

`.claude/statusline.py` is an optional Claude Code status-line script. It uses only the Python 3 standard library and makes no network calls.

## What it displays

Claude Code pipes a JSON payload to the script on each status-line refresh. The script prints a single line such as:

```
Opus | context 42% | 5h 61% | 7d 18% | spend $12/50
```

- `model.display_name` is always shown (falls back to `Claude`).
- `context N%` comes from `context_window.used_percentage`.
- `5h N%` / `7d N%` come from `rate_limits.five_hour` / `rate_limits.seven_day`.
- `spend` comes from `rate_limits.spend_limit` (dollar amounts when both `used_usd` and `limit_usd` are present, otherwise a percentage).
- Any field that is missing is omitted. `rate_limits` may be absent depending on plan, authentication method or gateway.
- If any value is at or above 90%, `WARNING <field> N%` is appended.
- If stdin is not valid JSON, it prints `Claude Code | usage data unavailable`.

## Alerts

- Thresholds: 80% and 90%.
- Each threshold alerts at most once per session, per metric and (for 5-hour/7-day windows) per reset time.
- Alert state is stored outside the repository in `~/.cache/openkinverse-claude/alerts.json`. The file is never pruned and grows slowly over time; it is safe to delete.
- Notification mechanism by platform:
  - macOS: native notification via `osascript`.
  - Linux: `notify-send` (if installed).
  - Windows and other systems: **only a terminal bell (`\a`) on stderr**; there is no desktop toast.
- Notification failures are ignored; the status line still renders.

## Configuration

The project `.claude/settings.json` runs:

```json
"command": "py .claude/statusline.py"
```

`py` is the Windows Python launcher. On Windows, `python3` may resolve to the Microsoft Store alias stub and fail.

On macOS/Linux, `py` usually does not exist. Override the command locally in `.claude/settings.local.json` (not committed):

```json
{
  "statusLine": {
    "type": "command",
    "command": "python3 .claude/statusline.py",
    "padding": 1,
    "refreshInterval": 60
  }
}
```

Alternatively, configure the script in your user `~/.claude/settings.json`, or run `/statusline` in Claude Code.

## Limitations

- Context-window percentage is not the same as account quota.
- The script cannot guarantee advance notice of a hard limit or prevent a quota reset. It only alerts when Claude Code supplies the relevant data on a refresh.

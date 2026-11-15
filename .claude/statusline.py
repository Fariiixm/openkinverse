#!/usr/bin/env python3
"""Claude Code status line with best-effort local usage threshold alerts.

No third-party Python packages. Missing rate-limit fields are expected and handled.
"""
from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any

THRESHOLDS = (80, 90)
STATE_DIR = Path.home() / ".cache" / "openkinverse-claude"
STATE_FILE = STATE_DIR / "alerts.json"


def pct(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return max(0.0, min(100.0, float(value)))
    except (TypeError, ValueError):
        return None


def notify(title: str, message: str) -> None:
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(
                ["osascript", "-e", f'display notification "{message}" with title "{title}"'],
                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3,
            )
        elif system == "Linux":
            subprocess.run(
                ["notify-send", title, message],
                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3,
            )
        elif system == "Windows":
            # Lightweight fallback. Desktop toast APIs differ by Windows/terminal setup.
            sys.stderr.write("\a")
            sys.stderr.flush()
        else:
            sys.stderr.write("\a")
            sys.stderr.flush()
    except (OSError, subprocess.SubprocessError):
        # The status line still shows the threshold even if desktop notification is unavailable.
        pass


def load_state() -> dict[str, Any]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict[str, Any]) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state), encoding="utf-8")
    except OSError:
        pass


def alert_once(state: dict[str, Any], key: str, label: str, value: float, session_id: str) -> None:
    seen_key = f"{session_id}:{key}"
    for threshold in THRESHOLDS:
        marker = f"{seen_key}:{threshold}"
        if value >= threshold and not state.get(marker):
            notify("Claude Code usage warning", f"{label}: {value:.0f}% used")
            state[marker] = True


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, TypeError):
        print("Claude Code | usage data unavailable")
        return 0

    model = (data.get("model") or {}).get("display_name") or "Claude"
    context = data.get("context_window") or {}
    context_used = pct(context.get("used_percentage"))
    rates = data.get("rate_limits") or {}
    five_hour = pct((rates.get("five_hour") or {}).get("used_percentage"))
    seven_day = pct((rates.get("seven_day") or {}).get("used_percentage"))
    spend = rates.get("spend_limit") or {}
    spend_used = pct(spend.get("used_percentage"))
    session_id = str(data.get("session_id") or "unknown-session")

    state = load_state()
    if context_used is not None:
        alert_once(state, "context", "Context window", context_used, session_id)
    if five_hour is not None:
        reset = (rates.get("five_hour") or {}).get("resets_at", "unknown-reset")
        alert_once(state, f"five-hour:{reset}", "5-hour usage window", five_hour, session_id)
    if seven_day is not None:
        reset = (rates.get("seven_day") or {}).get("resets_at", "unknown-reset")
        alert_once(state, f"seven-day:{reset}", "7-day usage window", seven_day, session_id)
    if spend_used is not None:
        alert_once(state, "spend", "Spend limit", spend_used, session_id)
    save_state(state)

    parts = [model]
    if context_used is not None:
        parts.append(f"context {context_used:.0f}%")
    if five_hour is not None:
        parts.append(f"5h {five_hour:.0f}%")
    if seven_day is not None:
        parts.append(f"7d {seven_day:.0f}%")
    if spend_used is not None:
        dollars = spend.get("used_usd")
        limit = spend.get("limit_usd")
        if dollars is not None and limit is not None:
            parts.append(f"spend ${dollars}/{limit}")
        else:
            parts.append(f"spend {spend_used:.0f}%")

    warnings = []
    for label, value in (("context", context_used), ("5h", five_hour), ("7d", seven_day), ("spend", spend_used)):
        if value is not None and value >= 90:
            warnings.append(f"WARNING {label} {value:.0f}%")
    parts.extend(warnings)
    print(" | ".join(parts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

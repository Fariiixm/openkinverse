# Start here — OpenKinverse

## 1. Create the GitHub repository

Create an empty public repository named `openkinverse` (if available), ideally without auto-generating README, license or .gitignore because this starter kit supplies those. Set the default branch to `main`.

Suggested description:

> Open-source engine for persistent, portable AI companions in spatial worlds.

Suggested topics (revise as code exists): `ai-companions`, `augmented-reality`, `spatial-computing`, `3d`, `agents`, `memory`, `open-source`.

Name status: `OpenKinverse` is a working suggestion, not trademark/domain clearance. Check GitHub org/repo availability, domains, package registries and relevant trademark databases before investing in branding.

## 2. Copy the starter files into your cloned repository

```bash
git clone https://github.com/YOUR-USER/openkinverse.git
cd openkinverse
# Extract/copy the starter-kit contents into this folder, including hidden files.
git status --short
```

Make sure `.claude/` and `.github/` hidden directories were copied.

## 3. Install/verify Claude Code

```bash
claude --version
claude doctor
```

Run `claude` from the repository root. Check `/agents` to see project agents and `/skills` (or invoke skill names) to see skills. Restart the session after adding or changing agent definitions if they do not appear.

## 4. Verify Graphify

There are multiple projects/plugins named Graphify. Do not install another one on top of your existing setup until you identify the one you have.

```bash
graphify --version
graphify --help
```

Also inspect the Claude Code `/plugin` list and available skills. Verify the `/graphify` command works. Build/update the graph with the command supported by your installed version. Exclude generated/private data, `.env`, room maps, camera frames, voice recordings and model weights.

## 5. Enable agent teams (optional but requested)

Project settings enable the experimental team flag. If your installed Claude Code version does not recognize teams, update Claude Code and rerun `claude doctor`. Start in the default in-process display; split panes require tmux or iTerm2. Agent teams use more tokens because each teammate has its own context window.

## 6. First Claude Code prompt

Open `FIRST_PROMPT.md` and paste its contents into Claude Code. Under the autonomy policy in `CLAUDE.md`, the lead session accepts ADRs and proceeds with implementation without waiting for owner approval.

## 7. GitHub governance

Before implementation:
- Protect `main` (no direct pushes; PR required).
- Require CI and at least one review where practical.
- Enable secret scanning and Dependabot alerts if available.
- Use GitHub Issues for scope and acceptance criteria.
- Use feature branches and PRs; agents merge only with green CI and an independent agent review (see `CLAUDE.md`).

## 8. Work in milestones with clean handoffs

Use one issue at a time per workstream. Ask the lead to spawn only the agents needed for independent tasks. Before any usage limit, error or end of session, invoke `/handoff`. Resume next session by reading `docs/STATUS.md` and `docs/NEXT_SESSION.md`.

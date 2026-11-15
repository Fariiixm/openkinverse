# Contributing

## Workflow

1. Open or select a GitHub issue with scope and acceptance criteria.
2. Create one branch per issue using `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `docs/<issue>-<slug>`, or `chore/<issue>-<slug>`.
3. Keep PRs focused. Prefer one owner per module and avoid parallel edits to shared files.
4. Run the checks listed in the relevant package README and `docs/QUALITY_GATES.md`.
5. Open a PR using the repository template. Link the issue and include test evidence, screenshots/video where relevant, privacy impact and migration notes.
6. Require CI, QA review and security review for sensitive changes before merge.

## Language

Write all repository and GitHub content in professional English: source code, identifiers, comments, technical documentation, ADRs, issues, pull requests, review comments and commit messages.

## Commit messages

Use Conventional Commits, e.g. `feat(spatial): persist room anchors`.

## Architecture changes

Changes affecting module boundaries, public APIs, character packages, memory, identity, sharing, spatial persistence, or provider interfaces require an ADR in `docs/decisions/`.

## Security and privacy

Never commit secrets, camera frames, room maps, voice recordings, private character memories, personal identifiers, or private generated assets. Report vulnerabilities privately using `SECURITY.md`.

## AI-generated contributions

AI agents implement, review and merge routine work under the autonomy policy in `CLAUDE.md`. An agent never reviews its own work: every PR needs an independent agent review and green CI before merge. Each PR states which checks were run, their real results and any unverified assumptions. Commits keep the real Git author and do not carry AI attribution trailers or promotional footers. The owner may veto any change or release.

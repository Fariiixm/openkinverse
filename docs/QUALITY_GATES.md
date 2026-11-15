# Quality gates

No PR may claim a check passed unless it was actually run.

## Commands

Stack per ADR-0001: TypeScript (strict) on Node.js 24, npm workspaces. Run from the repository root.

| Gate                                  | Command                 | What it does                                                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean install                         | `npm ci`                | Installs exactly what `package-lock.json` pins.                                                                                                                                                                                                |
| Formatting                            | `npm run format:check`  | Prettier check (`npm run format` rewrites).                                                                                                                                                                                                    |
| Lint                                  | `npm run lint`          | ESLint flat config with `typescript-eslint` `strictTypeChecked`; zero warnings allowed. `packages/simulation/src` (non-test) bans `Math.random`, `Date.now`, `new Date`, `performance.now` and `Math.sin/cos/tan/exp/log/pow` for determinism. |
| Typecheck                             | `npm run typecheck`     | `tsc` with `noEmit` for the root config and every workspace (`strict`, `noUncheckedIndexedAccess`).                                                                                                                                            |
| Unit tests                            | `npm test`              | Vitest over `packages/*/src`, `apps/*/src` and `scripts/`, then `npm run smoke:node` (plain `node` imports `apps/server/src/index.ts` via native type stripping and calls `/health`).                                                          |
| All of the above                      | `npm run check`         | `format:check` + `lint` + `typecheck` + `test`.                                                                                                                                                                                                |
| Repository hygiene                    | `npm run hygiene`       | Validates every JSON file and fails on `.env` files (except `.env.example`), keys/certificates, model weights and files in private-data directories.                                                                                           |
| Secret scan                           | `gitleaks git --redact` | gitleaks over the full git history.                                                                                                                                                                                                            |
| Dependency audit (advisory, not gate) | `npm audit`             | Reports known advisories; findings are triaged in the PR.                                                                                                                                                                                      |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`, with `contents: read` permissions only and concurrency cancellation per branch.

- `hygiene`: `node scripts/check-repo-hygiene.mjs`, then gitleaks `8.30.1` over the full history. gitleaks is downloaded from the upstream GitHub release and its SHA-256 is verified against a value pinned in the workflow before it runs; this avoids a third-party action with broader token access. Bump `GITLEAKS_VERSION` and `GITLEAKS_SHA256` together.
- `check`: Node.js from `.nvmrc` with the npm cache, `npm ci`, `npm run check`.

Official actions are pinned to full commit SHAs with the release tag in a comment. Dependabot (`.github/dependabot.yml`) proposes weekly updates for npm and GitHub Actions; updates are merged only after review.

## Every pull request

- Formatting and linting for touched packages.
- Static typing / compile / build for touched packages.
- Unit tests for changed domain logic.
- Integration tests for persistence, provider adapters and APIs where applicable.
- Dependency and license review for new packages/models/assets.
- Secret scanning and checks for accidentally added user data or model weights.
- Independent QA agent report with findings categorized as blocker/major/minor/nit. Merge only with no open blocker or major finding.

## Sensitive changes

Each change below additionally requires an independent `security-privacy-reviewer` report with no open blocker or major finding.

- Auth, permissions, friends, sharing, public profiles: authorization and tenant-isolation tests.
- Memory: inspect/edit/export/delete tests, provenance checks, retention policy tests.
- Camera, microphone, spatial data: permission-denied behavior, no-capture/no-upload defaults and deletion tests.
- Plugins/agents: capability allowlists, sandbox tests, tool validation and audit logs.
- Character package import: schema validation, archive path traversal checks, size limits, malware/untrusted asset handling.

## Release gate

- Clean CI on target platforms.
- Reproducible clean install from docs.
- Migration and rollback notes where applicable.
- Release notes and third-party notices.
- Independent QA and security agent sign-off recorded in the release PR.

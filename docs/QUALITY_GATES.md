# Quality gates

The exact commands will be filled in after the stack ADR is accepted. No PR may claim a check passed unless it was actually run.

## Every pull request
- Formatting and linting for touched packages.
- Static typing / compile / build for touched packages.
- Unit tests for changed domain logic.
- Integration tests for persistence, provider adapters and APIs where applicable.
- Dependency and license review for new packages/models/assets.
- Secret scanning and checks for accidentally added user data or model weights.
- Independent QA agent report with findings categorized as blocker/major/minor/nit. Merge only with no open blocker or major finding.

## Sensitive changes
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

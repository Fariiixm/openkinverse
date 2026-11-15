# Roadmap

## Phase 0 — Project foundation
- Product brief, architecture principles, ADR process and repository governance.
- Select the first mobile platform and AR runtime using a hardware support spike.
- Define CharacterBundle v0 and Scene/World State v0 schemas.
- Set CI, code quality, security and license inventory.

## Phase 1 — Persistent companion vertical slice
- One character and one room.
- Place and persist a spatial anchor.
- Relocalize after app close/reopen.
- Persist simulated state server-side/local-server-side.
- Run simple autonomous activities with deterministic simulation.
- Render in AR and trigger one interaction.
- Add voice/chat provider interface with mock provider.

## Phase 2 — Portable characters
- Character bundle export/import.
- QR/image-target identity binding and deep links.
- Asset package validation and dependency license metadata.
- Cross-device compatibility report.

## Phase 3 — Social and shared companions
- Friends/invitations and revocable access grants.
- Private, invited and public visibility.
- Separate shared character profile from private memories and personal home data.
- Multi-user interaction sessions.

## Phase 4 — Rich autonomy and perception
- More activities, navigation, object affordances and relationship simulation.
- Optional hand/object tracking, depth and occlusion.
- Multi-agent interactions and inspectable event journal.
- Optional smart-home integrations with explicit consent.

## Phase 5 — Ecosystem
- Plugin SDK and provider marketplace/catalog.
- Modding tools, creator gallery and community examples.
- Additional devices and spatial computing platforms.
- Scale testing, performance budgets and hosted optional services.

## Release rule

Do not mark a phase complete because agents say it is done. Require acceptance tests, reproducible setup, documentation, license/security review and a human maintainer approval.

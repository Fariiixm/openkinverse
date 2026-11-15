# OpenKinverse (working name)

**An open-source engine for persistent, portable, AI-powered companions in spatial environments.**

OpenKinverse aims to let people create characters with identity, memory, autonomy and a persistent place in a room or virtual world — then carry, share and meet those characters across devices and locations.

> Status: project bootstrap / discovery phase. This repository is a starter structure, not a working AR or AI companion application yet.

## Product principles

- **Persistent, not just generated:** characters and world state survive app restarts.
- **Spatially grounded:** characters can be anchored to real-world places and portable objects (QR, image targets, NFC where supported, or spatial anchors).
- **Portable identity:** character packages should be exportable and importable without binding their identity to one model provider.
- **Autonomy with boundaries:** needs, schedules, relationships and decisions are simulated; no claim of consciousness or real feelings.
- **User-owned memory:** inspect, export, edit, scope and delete memories.
- **Private by default:** explicit sharing scopes for owner-only, invited people/friends, and public characters.
- **Provider-neutral:** local models and external APIs use versioned adapters.
- **Open by design:** documented schemas, plugin SDK, reproducible builds and transparent third-party licenses.

## Initial vertical slice

1. Create one character profile and one room.
2. Place the character on a table using a local spatial anchor or a printable visual marker.
3. Persist character identity, state, room graph and location.
4. Run a lightweight autonomous simulation while the AR client is closed.
5. Reopen the app, relocalize the room and render the character at its saved location.
6. Talk to the character and observe a safe, deterministic animation/action response.
7. Export/import the character package.

Do not start with a full social network, multi-house simulation, marketplace, or unrestricted autonomous tools. Prove the vertical slice first.

## Development status

See `docs/PRODUCT_VISION.md`, `docs/ROADMAP.md`, and `docs/ARCHITECTURE_PRINCIPLES.md`.

## Contributing

Read `CONTRIBUTING.md`. All changes go through pull requests and automated checks. Never commit API keys, private conversations, room scans, camera images, personal memories, generated private assets, or proprietary model weights.

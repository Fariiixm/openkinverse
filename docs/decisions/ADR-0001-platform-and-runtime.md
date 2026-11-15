# ADR-0001: Platform and runtime

- Status: Accepted (after principal-architect review on PR #28)
- Date: 2026-11-15
- Decision owners: Engineering lead (autonomy policy in `CLAUDE.md`); owner may override

## Context

OpenKinverse needs a first runtime that lets a small, mostly agent-driven team deliver the Phase 1 vertical slice: one character, one room, persistent deterministic simulation, AR placement and a mock dialogue provider. Constraints:

- Development and CI happen on Windows and Linux without Apple hardware or physical AR devices in the loop. Anything device-specific must degrade gracefully and be testable without a device.
- The product is open source and provider-neutral; contributors should be able to run it with free tools only.
- Domain logic (simulation, validation, schemas) must be shared between server, client and SDK without duplication.
- Target phones are not yet specified by the owner.

## Options considered

1. **TypeScript everywhere + web client with WebXR.** One language for server, client, SDK and schemas. WebXR `immersive-ar` with hit-test and anchors runs in Chrome on ARCore-capable Android devices and in Meta Quest Browser (which also offers a non-standard persistent-anchor extension). Chrome implements the WebXR Anchors module without cross-session persistence. Safari on iOS does not expose `immersive-ar`, so iOS falls back to a non-AR 3D viewer. No app-store distribution; zero install for testers. Limited access to native capabilities (no persistent cloud anchors in standard WebXR, no ARKit world maps).
2. **Unity (AR Foundation) client + separate backend.** Mature cross-platform AR on ARKit and ARCore, persistent anchors via vendor services. Proprietary engine with license terms and runtime fee history, heavy toolchain, C# client vs. a different backend language, and no way to build or test iOS here. Hard for agents to verify in CI.
3. **Native Swift (ARKit) + Kotlin (ARCore) clients.** Best platform fidelity, two codebases, requires macOS and devices for iOS, slowest iteration.
4. **Godot with OpenXR.** Open-source engine; mobile camera-passthrough AR support is immature compared with WebXR and AR Foundation.

## Decision

Adopt **option 1** for Phases 1–2:

- **Language/runtime:** TypeScript (strict) on Node.js 24 LTS. npm workspaces monorepo.
- **Shared packages:** `@openkinverse/core` (IDs, schemas, scopes), `@openkinverse/simulation` (deterministic engine), `@openkinverse/mind` (dialogue provider interface, mock, intent validator). Platform-neutral, no Node- or browser-only APIs.
- **Client:** a web app (Vite + three.js) with two render modes: a 3D viewer for any desktop/mobile browser, and WebXR `immersive-ar` where supported.
- **First anchor strategy:** _room-origin alignment_. The user places a room origin on a detected floor point via WebXR hit-test (optionally next to a printed marker to make re-alignment repeatable), then sets the heading (yaw) by placing a second floor point along a reference direction (for example along the marker edge or a wall). Origin plus heading define the room frame; the floor-plane normal defines up. All character and object poses are stored room-relative. After reopening, the user re-places the origin and heading; persisted state is re-projected. Re-projection error grows with distance from the origin (a heading error of e degrees displaces a point at distance d by about d * e * pi / 180). Acceptance target for #16 (unverified on devices): with a printed marker, a character placed 2 m from the origin reappears within 0.15 m on re-alignment. Platform anchors (WebXR anchors, ARCore Cloud Anchors, ARKit world maps) are later `SpatialAnchorProvider` adapters behind a versioned interface.
- **Device test path:** WebXR requires a secure context. The supported development path is Android Chrome with `adb reverse tcp:<port> tcp:<port>`, so the phone reaches the dev server as `http://localhost`, which browsers treat as secure. An explicit opt-in LAN mode with a locally generated TLS certificate may be added later; the server never binds to non-loopback interfaces by default.
- Native or engine clients (Unity, Swift, Kotlin) are deferred to a later ADR once the domain contracts and server API stabilize; they will consume the same API and bundle formats.

## Consequences

- Fast iteration and full CI coverage for domain logic; the AR path needs manual device testing and is reported as such.
- iOS users get the 3D viewer only until a native client exists. This is documented in the README and in the client.
- Room-origin alignment needs a user step on return; it is honest about tracking limits and does not require cloud services.
- Migration: because state is room-relative and anchor providers are an interface, adding native anchors later does not change persisted world state.

## Evidence

- Verified on the development machine: Node.js v24.7.0 and npm 11.7.0 are available.
- Platform support for WebXR `immersive-ar` (Chrome Android with ARCore, Quest Browser) and its absence in iOS Safari is based on vendor documentation as of the decision date and has **not** been verified on devices for this project. Device verification is part of issue #16.

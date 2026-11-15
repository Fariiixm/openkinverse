# Product vision

## One sentence

OpenKinverse is an open-source platform for creating persistent, portable AI companions that inhabit spatial environments, develop simulated routines and relationships, and can be carried or shared across places and devices.

## User promise

Create a character, give it an identity and a home, and return later to find its world state preserved. Meet it through AR, a camera view, a desktop viewer or a future spatial device. Share the character with selected friends or publish it, while keeping personal memories private by default.

## Core capabilities (long-term)

- Character Studio: images, sketches, prompts, reference images, 3D assets, animation and voice.
- Persistent World: rooms, surfaces, spatial anchors, navigation graph, object affordances and world state.
- Autonomous Simulation: deterministic needs, schedules, activities, movement, relationships and event log.
- Companion Mind: pluggable LLM, short- and long-term memory, dialogue, tool use and personality.
- Reality Runtime: camera passthrough, relocalization, occlusion, hand tracking, interaction and multi-device support.
- Portable Identity: exportable character bundle with identity, assets, behavior configuration, memory export (optional), compatibility metadata and signatures.
- Object Binding: QR/image target/NFC identifier can resolve a character or world object. Spatial pose must be provided by a tracking system; a QR code alone is an identifier, not a full spatial anchor.
- Social Sharing: owner-only, invited users/friends, and public. Sharing a character does not automatically share private memories, room maps or personal data.
- Provider and Plugin SDK: interchangeable 3D, image, video, speech, LLM, memory, vision, storage and hosting providers.

## Product boundaries

- The product simulates believable life; it must not claim that characters are conscious or genuinely sentient.
- A character is not permitted to take unrestricted actions outside its sandbox.
- Camera, microphone, spatial mapping and cloud inference are opt-in and visible to the user.
- Public character identity, private owner memory and per-friend interaction permissions are different data scopes.

## First target user

A developer/creator who wants to create one virtual companion, anchor it to a physical place, close the app, return later, and find the character's simulated state preserved.

## First vertical slice

One mobile-capable AR client, one room, one character, one stable anchor strategy, one simulated routine, one dialogue provider interface, one persistent world store, and one export/import path. Prefer deterministic mocks for external models until the contracts and UX are stable.

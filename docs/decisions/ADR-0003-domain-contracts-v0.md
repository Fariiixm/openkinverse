# ADR-0003: Domain contracts v0 (identity, CharacterBundle, sharing scopes)

- Status: Accepted (after principal-architect review on PR #28; ADR-0003 also reviewed by security-privacy-reviewer before merge)
- Date: 2026-11-15
- Decision owners: Engineering lead (autonomy policy in `CLAUDE.md`); owner may override

## Context

Characters must be portable across devices and environments, shareable with selected people, and identifiable by physical objects, without leaking private memories or room data. These contracts are shared by server, client and SDK and must be versioned from day one.

## Decision

### Identifiers

- Opaque, prefixed, URL-safe IDs: `<prefix>_<26 Crockford base32 characters>` (ULID body), e.g. `chr_01JD3...`. Prefixes: `chr` character, `wld` world, `room` room, `obj` object, `anc` spatial anchor, `bind` object binding, `mem` memory, `evt` event, `usr` user, `grant` access grant.
- IDs never encode personal data or location. Trade-off: ULID bodies embed a millisecond creation timestamp, so an ID reveals when the resource was created. This is accepted for sortable, index-friendly IDs; resources whose creation time is sensitive must use a separate public alias.

### Separate concepts

| Concept | Meaning | Portable in bundle |
| --- | --- | --- |
| Character identity | Stable `chr_` ID, profile, personality, appearance, behavior config | Yes |
| World / room | A home and its rooms, logical layout, object catalog | No (private by default) |
| Spatial anchor | Device- or provider-specific pose reference for a room | Never |
| Room map / scan | Geometry captured by a device | Never |
| Object binding | Maps a physical identifier (QR payload, NFC tag ID, image target) to a character or object ID | Optional, without location |
| Memory | Owner-scoped record with provenance | Only with explicit opt-in, separately |

QR codes and NFC tags resolve identity only. Pose always comes from a tracking provider. Possession of a QR payload or NFC tag is not authorization: resolution is subject to the target's sharing scope, and a private resource resolves to the same "not found" response for non-authorized viewers, without disclosing its existence.

### Sharing scopes

- `private` (default), `invited` (explicit grants to users), `public` (profile is discoverable and viewable; interaction requires a separate interaction grant). `public` never applies to memories, worlds, anchors, room maps or conversation history.
- Scope applies per resource. Sharing a character's profile does not share its memories, worlds, anchors, room maps or conversation history; each needs its own grant.
- Authorization is deny by default; missing or unknown scope values are rejected, never coerced.

### CharacterBundle v0

A JSON manifest (`manifest.json`) plus referenced asset files:

- `bundleFormat`: `"openkinverse.character-bundle"`; `schemaVersion`: `"0.1.0"` (SemVer; readers reject unknown major versions).
- `character`: `id`, `name`, `description`, `personality` (bounded numeric traits), `appearance` (preset reference and parameters), `schedule` (activity blocks), `needs` (configured needs and decay rates).
- `assets`: list of `{ path, mediaType, sha256, bytes, license }`. Paths are relative, normalized, without `..` or absolute prefixes.
- `provenance`: creator display name (optional), creation tool, created/updated timestamps, licenses.
- `compatibility`: minimum runtime version and required provider capabilities.
- `includes`: `{ memories: false, worldState: false }`. In v0 readers reject `true` for either field until ADR-0004 defines a separately encrypted memory export. Room maps and anchors are not representable in the format. Bundle signatures are deferred and not part of v0.

All contracts are defined as runtime-validated schemas (Zod) in `@openkinverse/core`; TypeScript types are derived from the schemas, so validation and types cannot drift.

## Consequences

- Version compatibility: a reader accepts bundles with the same major version and a minor version less than or equal to its own. Bundles with a higher minor or a different major are rejected with an explicit "upgrade runtime" error. Within a known version, unknown fields are rejected. Additive changes bump the minor version; breaking changes bump the major version and ship a migration. This rule applies equally to major version 0.
- Zod becomes a runtime dependency of `@openkinverse/core` (MIT license).

## Options considered

- **JSON Schema files + code generation:** language-neutral but adds a build step and drift risk now. JSON Schema can be generated from the Zod schemas later for non-TypeScript clients.
- **Protocol Buffers:** strong versioning, poor fit for human-editable creator bundles.

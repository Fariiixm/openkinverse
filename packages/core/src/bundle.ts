import { z } from 'zod';
import { CharacterIdSchema } from './ids.ts';

/**
 * CharacterBundle v0 manifest (ADR-0003).
 *
 * A bundle is a `manifest.json` plus referenced asset files. All objects are
 * strict: unknown fields are rejected. Room maps, scans and spatial anchors
 * are intentionally not representable. Memories and world state cannot be
 * included in v0 (`includes` flags must be `false`).
 *
 * Personality, needs and schedule values are simulation configuration; they
 * do not describe real feelings.
 */

export const CHARACTER_BUNDLE_FORMAT = 'openkinverse.character-bundle';
export const CHARACTER_BUNDLE_SCHEMA_VERSION = '0.1.0';
export const BUNDLE_MANIFEST_FILENAME = 'manifest.json';

// SemVer 2.0.0 (https://semver.org), official regular expression.
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export const SemverSchema = z
  .string()
  .regex(SEMVER_REGEX, { message: 'Expected a SemVer version' });

export interface SemverCore {
  major: number;
  minor: number;
  patch: number;
}

/** Returns the numeric core of a SemVer string, or `undefined` if invalid. */
export function parseSemverCore(version: string): SemverCore | undefined {
  const match = SEMVER_REGEX.exec(version);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

const READER_VERSION: SemverCore = { major: 0, minor: 1, patch: 0 }; // CHARACTER_BUNDLE_SCHEMA_VERSION

/**
 * Compatibility rule (ADR-0003): a reader accepts bundles with the same major
 * version and a minor version less than or equal to its own. This applies
 * equally to major version 0. Patch versions are always compatible.
 */
export function isSupportedBundleSchemaVersion(version: string): boolean {
  const v = parseSemverCore(version);
  return v !== undefined && v.major === READER_VERSION.major && v.minor <= READER_VERSION.minor;
}

const unsupportedVersionMessage = (version: string) =>
  `Bundle schema version ${version} is not supported by this runtime (reads ${String(READER_VERSION.major)}.0 to ${String(READER_VERSION.major)}.${String(READER_VERSION.minor)}); upgrade the runtime`;

export const BundleSchemaVersionSchema = SemverSchema.superRefine((version, ctx) => {
  if (!isSupportedBundleSchemaVersion(version)) {
    ctx.addIssue({ code: 'custom', message: unsupportedVersionMessage(version) });
  }
});

/** Lowercase identifier key used for traits, needs, activities and capabilities. */
export const KeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, { message: 'Expected a lowercase key ([a-z][a-z0-9_]*)' });

const UnitIntervalSchema = z.number().finite().min(0).max(1);

const MAX_PATH_LENGTH = 512;

/**
 * Returns a reason when `path` is not a safe, normalized, relative bundle path,
 * or `undefined` when it is acceptable.
 */
export function assetPathProblem(path: string): string | undefined {
  if (path.length === 0) return 'path must not be empty';
  if (path.length > MAX_PATH_LENGTH)
    return `path must be at most ${String(MAX_PATH_LENGTH)} characters`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return 'path must not contain control characters';
  if (path.includes('\\')) return 'path must use forward slashes only';
  if (/^[A-Za-z]:/.test(path)) return 'path must not start with a drive letter';
  if (path.includes(':')) return 'path must not contain ":"';
  if (path.startsWith('/')) return 'path must be relative';
  if (path.endsWith('/')) return 'path must reference a file, not a directory';
  for (const segment of path.split('/')) {
    if (segment === '') return 'path must not contain empty segments';
    if (segment === '.' || segment === '..') return 'path must not contain "." or ".." segments';
  }
  if (path === BUNDLE_MANIFEST_FILENAME) return 'path must not reference the manifest itself';
  return undefined;
}

export const AssetPathSchema = z.string().superRefine((path, ctx) => {
  const problem = assetPathProblem(path);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

export const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, { message: 'Expected a lowercase hex SHA-256 digest' });

export const MediaTypeSchema = z
  .string()
  .max(127)
  .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/, {
    message: 'Expected a lowercase media type such as "model/gltf-binary"',
  });

/** License identifier or SPDX expression, e.g. "CC-BY-4.0" or "MIT OR Apache-2.0". */
export const LicenseSchema = z.string().trim().min(1).max(128);

export const BundleAssetSchema = z
  .object({
    path: AssetPathSchema,
    mediaType: MediaTypeSchema,
    sha256: Sha256HexSchema,
    bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    license: LicenseSchema,
  })
  .strict();
export type BundleAsset = z.infer<typeof BundleAssetSchema>;

export const MAX_PERSONALITY_TRAITS = 32;

/** Bounded numeric personality traits in [0, 1], keyed by trait name. */
export const PersonalitySchema = z
  .object({
    traits: z
      .record(KeySchema, UnitIntervalSchema)
      .refine((traits) => Object.keys(traits).length <= MAX_PERSONALITY_TRAITS, {
        message: `At most ${String(MAX_PERSONALITY_TRAITS)} traits are allowed`,
      }),
  })
  .strict();
export type Personality = z.infer<typeof PersonalitySchema>;

export const AppearanceSchema = z
  .object({
    preset: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, {
      message: 'Expected a preset reference such as "default.round-01"',
    }),
    parameters: z
      .record(KeySchema, z.union([z.number().finite(), z.string().max(256), z.boolean()]))
      .refine((params) => Object.keys(params).length <= 64, {
        message: 'At most 64 appearance parameters are allowed',
      })
      .default({}),
  })
  .strict();
export type Appearance = z.infer<typeof AppearanceSchema>;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const MINUTES_PER_DAY = 1440;

/** A recurring activity block in local room time, `[startMinute, endMinute)`. */
export const ScheduleBlockSchema = z
  .object({
    activity: KeySchema,
    days: z
      .array(WeekdaySchema)
      .min(1)
      .refine((days) => new Set(days).size === days.length, { message: 'Duplicate days' }),
    startMinute: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_PER_DAY - 1),
    endMinute: z.number().int().min(1).max(MINUTES_PER_DAY),
  })
  .strict()
  .refine((block) => block.startMinute < block.endMinute, {
    message: 'startMinute must be before endMinute',
    path: ['endMinute'],
  });
export type ScheduleBlock = z.infer<typeof ScheduleBlockSchema>;

export const ScheduleSchema = z
  .object({
    blocks: z
      .array(ScheduleBlockSchema)
      .max(256)
      .superRefine((blocks, ctx) => {
        blocks.forEach((a, i) => {
          blocks.forEach((b, j) => {
            if (j <= i) return;
            const sharesDay = a.days.some((day) => b.days.includes(day));
            const overlaps = a.startMinute < b.endMinute && b.startMinute < a.endMinute;
            if (sharesDay && overlaps) {
              ctx.addIssue({
                code: 'custom',
                message: `Schedule blocks ${String(i)} and ${String(j)} overlap`,
                path: [j],
              });
            }
          });
        });
      }),
  })
  .strict();
export type Schedule = z.infer<typeof ScheduleSchema>;

/** A simulated need; values are in [0, 1] and decay linearly per simulated hour. */
export const NeedConfigSchema = z
  .object({
    key: KeySchema,
    initial: UnitIntervalSchema,
    decayPerHour: UnitIntervalSchema,
  })
  .strict();
export type NeedConfig = z.infer<typeof NeedConfigSchema>;

export const NeedsSchema = z
  .array(NeedConfigSchema)
  .max(16)
  .refine((needs) => new Set(needs.map((n) => n.key)).size === needs.length, {
    message: 'Duplicate need keys',
  });

export const CharacterDefinitionSchema = z
  .object({
    id: CharacterIdSchema,
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000),
    personality: PersonalitySchema,
    appearance: AppearanceSchema,
    schedule: ScheduleSchema,
    needs: NeedsSchema,
  })
  .strict();
export type CharacterDefinition = z.infer<typeof CharacterDefinitionSchema>;

const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const ProvenanceSchema = z
  .object({
    creatorDisplayName: z.string().trim().min(1).max(100).optional(),
    creationTool: z.string().trim().min(1).max(128),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    licenses: z.array(LicenseSchema).min(1).max(32),
  })
  .strict()
  .refine((p) => Date.parse(p.updatedAt) >= Date.parse(p.createdAt), {
    message: 'updatedAt must not be earlier than createdAt',
    path: ['updatedAt'],
  });
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const CompatibilitySchema = z
  .object({
    minRuntimeVersion: SemverSchema,
    requiredCapabilities: z
      .array(KeySchema)
      .max(64)
      .refine((caps) => new Set(caps).size === caps.length, { message: 'Duplicate capabilities' })
      .default([]),
  })
  .strict();
export type Compatibility = z.infer<typeof CompatibilitySchema>;

/**
 * Private-data flags. In v0 both must be `false` (and default to `false`):
 * readers reject `true` until ADR-0004 defines a separately encrypted memory
 * export. Room maps, scans and spatial anchors have no flag because they are
 * never portable.
 */
export const BundleIncludesSchema = z
  .object({
    memories: z.literal(false).default(false),
    worldState: z.literal(false).default(false),
  })
  .strict()
  .default({ memories: false, worldState: false });
export type BundleIncludes = z.infer<typeof BundleIncludesSchema>;

export const MAX_BUNDLE_ASSETS = 1000;

export const CharacterBundleManifestSchema = z
  .object({
    bundleFormat: z.literal(CHARACTER_BUNDLE_FORMAT),
    schemaVersion: BundleSchemaVersionSchema,
    character: CharacterDefinitionSchema,
    assets: z
      .array(BundleAssetSchema)
      .max(MAX_BUNDLE_ASSETS)
      .superRefine((assets, ctx) => {
        const seen = new Set<string>();
        assets.forEach((asset, index) => {
          if (seen.has(asset.path)) {
            ctx.addIssue({
              code: 'custom',
              message: `Duplicate asset path: ${asset.path}`,
              path: [index, 'path'],
            });
          }
          seen.add(asset.path);
        });
      }),
    provenance: ProvenanceSchema,
    compatibility: CompatibilitySchema,
    includes: BundleIncludesSchema,
  })
  .strict();

/** Parsed manifest, with defaults applied. */
export type CharacterBundleManifest = z.infer<typeof CharacterBundleManifestSchema>;
/** Manifest as accepted on input, before defaults are applied. */
export type CharacterBundleManifestInput = z.input<typeof CharacterBundleManifestSchema>;

/**
 * Validates an untrusted manifest. Checks the schema version first so
 * readers report an unsupported version instead of unrelated field errors.
 */
export type CharacterBundleParseResult =
  { success: true; data: CharacterBundleManifest } | { success: false; error: z.ZodError };

const VersionOnlySchema = z.object({ schemaVersion: BundleSchemaVersionSchema });

export function parseCharacterBundleManifest(input: unknown): CharacterBundleParseResult {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input) {
    const version = VersionOnlySchema.safeParse({ schemaVersion: input.schemaVersion });
    if (!version.success) return { success: false, error: version.error };
  }
  const result = CharacterBundleManifestSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

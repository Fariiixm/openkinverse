import { describe, expect, it } from 'vitest';
import {
  CHARACTER_BUNDLE_FORMAT,
  CHARACTER_BUNDLE_SCHEMA_VERSION,
  CharacterBundleManifestSchema,
  type CharacterBundleManifestInput,
  AssetPathSchema,
  MAX_PERSONALITY_TRAITS,
  assetPathProblem,
  isSupportedBundleSchemaVersion,
  parseCharacterBundleManifest,
} from './index.ts';

const SHA = 'a'.repeat(64);

function validManifest(): CharacterBundleManifestInput {
  return {
    bundleFormat: CHARACTER_BUNDLE_FORMAT,
    schemaVersion: CHARACTER_BUNDLE_SCHEMA_VERSION,
    character: {
      id: 'chr_01ARYZ6S41TSV4RRFFQ69G5FAV',
      name: 'Pip',
      description: 'A small simulated companion.',
      personality: { traits: { curiosity: 0.8, calm: 0.4, playfulness: 1, shyness: 0 } },
      appearance: {
        preset: 'default.round-01',
        parameters: { hue: 210, hat: true, accent: 'blue' },
      },
      schedule: {
        blocks: [
          { activity: 'sleep', days: ['mon', 'tue'], startMinute: 0, endMinute: 420 },
          { activity: 'read', days: ['mon'], startMinute: 420, endMinute: 480 },
          { activity: 'play', days: ['wed'], startMinute: 0, endMinute: 1440 },
        ],
      },
      needs: [
        { key: 'energy', initial: 1, decayPerHour: 0.05 },
        { key: 'social', initial: 0.5, decayPerHour: 0.02 },
      ],
    },
    assets: [
      {
        path: 'models/pip.glb',
        mediaType: 'model/gltf-binary',
        sha256: SHA,
        bytes: 1024,
        license: 'CC-BY-4.0',
      },
      {
        path: 'textures/skin.png',
        mediaType: 'image/png',
        sha256: 'b'.repeat(64),
        bytes: 0,
        license: 'CC0-1.0',
      },
    ],
    provenance: {
      creatorDisplayName: 'Example Creator',
      creationTool: 'openkinverse-editor 0.1.0',
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T12:00:00+01:00',
      licenses: ['CC-BY-4.0'],
    },
    compatibility: { minRuntimeVersion: '0.1.0', requiredCapabilities: ['dialogue_mock'] },
  };
}

type Path = readonly (string | number)[];
const DELETE = Symbol('delete');

type Node = Record<string | number, unknown>;

/** Returns a deep copy of a valid manifest with values replaced or deleted. */
function edited(edits: readonly (readonly [Path, unknown])[]): unknown {
  const root = JSON.parse(JSON.stringify(validManifest())) as Node;
  for (const [path, value] of edits) {
    let node = root;
    for (const key of path.slice(0, -1)) node = node[key] as Node;
    const last = path[path.length - 1];
    if (last === undefined) throw new Error('empty path');
    if (value === DELETE) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete node[last];
    } else {
      node[last] = value;
    }
  }
  return root;
}

const mutated = (path: Path, value: unknown): unknown => edited([[path, value]]);

describe('CharacterBundle v0 manifest', () => {
  it('accepts a valid manifest and applies private defaults', () => {
    const result = parseCharacterBundleManifest(validManifest());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.includes).toEqual({ memories: false, worldState: false });
    expect(result.data.character.name).toBe('Pip');
  });

  it('accepts explicit false includes flags', () => {
    const result = CharacterBundleManifestSchema.parse(
      mutated(['includes'], { memories: false, worldState: false }),
    );
    expect(result.includes).toEqual({ memories: false, worldState: false });
  });

  it('accepts minimal optional fields', () => {
    const m = edited([
      [['provenance', 'creatorDisplayName'], DELETE],
      [['compatibility', 'requiredCapabilities'], DELETE],
      [['character', 'appearance', 'parameters'], DELETE],
      [['assets'], []],
      [['character', 'schedule', 'blocks'], []],
      [['character', 'needs'], []],
    ]);
    const result = CharacterBundleManifestSchema.parse(m);
    expect(result.compatibility.requiredCapabilities).toEqual([]);
    expect(result.character.appearance.parameters).toEqual({});
  });

  it('applies the same-major, minor <= reader compatibility rule', () => {
    expect(CHARACTER_BUNDLE_SCHEMA_VERSION).toBe('0.1.0');
    expect(isSupportedBundleSchemaVersion('0.1.0')).toBe(true);
    expect(isSupportedBundleSchemaVersion('0.1.7')).toBe(true);
    expect(isSupportedBundleSchemaVersion('0.0.3')).toBe(true);
    expect(isSupportedBundleSchemaVersion('0.2.0')).toBe(false);
    expect(isSupportedBundleSchemaVersion('1.0.0')).toBe(false);
    expect(isSupportedBundleSchemaVersion('0.1')).toBe(false);
    expect(parseCharacterBundleManifest(mutated(['schemaVersion'], '0.1.1')).success).toBe(true);
  });

  describe('rejects', () => {
    const traits33 = Object.fromEntries(
      Array.from({ length: MAX_PERSONALITY_TRAITS + 1 }, (_, i) => [`t${String(i)}`, 0.5]),
    );
    const cases: [string, Path, unknown][] = [
      ['wrong bundleFormat', ['bundleFormat'], 'other'],
      ['unknown major version', ['schemaVersion'], '1.0.0'],
      ['higher minor version', ['schemaVersion'], '0.2.0'],
      ['non-semver version', ['schemaVersion'], '0.1'],
      ['missing schemaVersion', ['schemaVersion'], DELETE],
      ['unknown top-level field', ['extra'], true],
      ['room maps field', ['roomMaps'], []],
      ['anchors field', ['anchors'], []],
      ['includes.memories true', ['includes'], { memories: true }],
      ['includes.worldState true', ['includes'], { worldState: true }],
      ['unknown includes flag', ['includes'], { roomMaps: false }],
      ['non-boolean includes flag', ['includes'], { memories: 'no' }],
      ['unknown character field', ['character', 'mood'], 'happy'],
      ['invalid character id', ['character', 'id'], 'usr_01ARYZ6S41TSV4RRFFQ69G5FAV'],
      ['empty name', ['character', 'name'], '   '],
      ['long name', ['character', 'name'], 'x'.repeat(101)],
      ['trait above 1', ['character', 'personality', 'traits', 'calm'], 1.01],
      ['trait below 0', ['character', 'personality', 'traits', 'calm'], -0.1],
      ['non-finite trait', ['character', 'personality', 'traits', 'calm'], Infinity],
      ['invalid trait key', ['character', 'personality', 'traits', 'Bad Key'], 0.5],
      ['too many traits', ['character', 'personality', 'traits'], traits33],
      ['unknown personality field', ['character', 'personality', 'feelings'], {}],
      ['invalid appearance preset', ['character', 'appearance', 'preset'], '../x'],
      ['object appearance parameter', ['character', 'appearance', 'parameters', 'x'], {}],
      ['schedule start >= end', ['character', 'schedule', 'blocks', 1, 'endMinute'], 420],
      ['schedule beyond a day', ['character', 'schedule', 'blocks', 2, 'endMinute'], 1441],
      ['schedule with no days', ['character', 'schedule', 'blocks', 0, 'days'], []],
      ['schedule duplicate days', ['character', 'schedule', 'blocks', 0, 'days'], ['mon', 'mon']],
      ['schedule unknown day', ['character', 'schedule', 'blocks', 0, 'days'], ['funday']],
      ['overlapping schedule blocks', ['character', 'schedule', 'blocks', 1, 'startMinute'], 419],
      ['duplicate need keys', ['character', 'needs', 1, 'key'], 'energy'],
      ['need decay above 1', ['character', 'needs', 0, 'decayPerHour'], 2],
      ['need initial below 0', ['character', 'needs', 0, 'initial'], -1],
      ['uppercase sha256', ['assets', 0, 'sha256'], 'A'.repeat(64)],
      ['short sha256', ['assets', 0, 'sha256'], 'a'.repeat(63)],
      ['non-hex sha256', ['assets', 0, 'sha256'], 'g'.repeat(64)],
      ['negative bytes', ['assets', 0, 'bytes'], -1],
      ['fractional bytes', ['assets', 0, 'bytes'], 1.5],
      ['invalid media type', ['assets', 0, 'mediaType'], 'glb'],
      ['empty license', ['assets', 0, 'license'], ''],
      ['unknown asset field', ['assets', 0, 'url'], 'https://example.com'],
      ['duplicate asset paths', ['assets', 1, 'path'], 'models/pip.glb'],
      ['traversal asset path', ['assets', 0, 'path'], '../../etc/passwd'],
      ['missing createdAt', ['provenance', 'createdAt'], DELETE],
      ['non-ISO timestamp', ['provenance', 'createdAt'], '15/11/2026'],
      ['updatedAt before createdAt', ['provenance', 'updatedAt'], '2026-11-14T00:00:00Z'],
      ['empty provenance licenses', ['provenance', 'licenses'], []],
      ['invalid minRuntimeVersion', ['compatibility', 'minRuntimeVersion'], 'latest'],
      ['duplicate capabilities', ['compatibility', 'requiredCapabilities'], ['a', 'a']],
    ];

    it.each(cases)('%s', (_label, path, value) => {
      expect(parseCharacterBundleManifest(mutated(path, value)).success).toBe(false);
    });

    it('reports unsupported versions with an upgrade hint on schemaVersion', () => {
      const result = parseCharacterBundleManifest(mutated(['schemaVersion'], '0.2.0'));
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.path).toEqual(['schemaVersion']);
      expect(result.error.issues[0]?.message).toContain('upgrade the runtime');
    });

    it.each([null, 'manifest', 42, []])('non-object input %s', (input) => {
      expect(parseCharacterBundleManifest(input).success).toBe(false);
    });
  });
});

describe('asset path validation', () => {
  it.each([
    'a.png',
    'models/pip.glb',
    'deep/nested/dir/file.bin',
    'name with spaces.txt',
    '.hidden/file',
    'a..b/c',
  ])('accepts %s', (path) => {
    expect(assetPathProblem(path)).toBeUndefined();
    expect(AssetPathSchema.safeParse(path).success).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['parent traversal', '../secret'],
    ['nested traversal', 'models/../../etc/passwd'],
    ['trailing traversal', 'models/..'],
    ['dot segment', './models/pip.glb'],
    ['inner dot segment', 'models/./pip.glb'],
    ['absolute posix', '/etc/passwd'],
    ['backslash', 'models\\pip.glb'],
    ['windows traversal', '..\\..\\windows\\system32'],
    ['drive letter', 'C:/Windows/system32'],
    ['drive-relative', 'c:pip.glb'],
    ['UNC path', '\\\\server\\share\\file'],
    ['protocol-relative', '//server/share'],
    ['URL scheme', 'file:///etc/passwd'],
    ['alternate data stream', 'pip.glb:stream'],
    ['empty segment', 'models//pip.glb'],
    ['directory', 'models/'],
    ['NUL byte', 'pip.glb\u0000.png'],
    ['newline', 'pip\n.glb'],
    ['manifest itself', 'manifest.json'],
    ['too long', 'a'.repeat(513)],
  ])('rejects %s', (_label, path) => {
    expect(assetPathProblem(path)).toBeTypeOf('string');
    expect(AssetPathSchema.safeParse(path).success).toBe(false);
  });
});

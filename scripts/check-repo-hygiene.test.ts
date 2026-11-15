import { describe, expect, it } from 'vitest';
import { forbiddenReason, stripJsonc } from './check-repo-hygiene.mjs';

describe('forbiddenReason', () => {
  it.each([
    '.env',
    'apps/server/.env',
    '.env.local',
    'certs/server.pem',
    'id.key',
    'signing.p12',
    'models/tiny.onnx',
    'weights/model.safetensors',
    'a/b.ckpt',
    'c.pt',
    'd.pth',
    'room-maps/kitchen.json',
    'apps/server/private-data/notes.txt',
    'model-weights/readme.txt',
  ])('rejects %s', (path) => {
    expect(forbiddenReason(path)).not.toBeNull();
  });

  it.each([
    '.env.example',
    'apps/server/.env.example',
    'README.md',
    'packages/core/src/index.ts',
    'docs/room-maps.md',
    'src/keyboard.ts',
  ])('allows %s', (path) => {
    expect(forbiddenReason(path)).toBeNull();
  });
});

describe('stripJsonc', () => {
  it('removes comments and trailing commas but keeps string contents', () => {
    const text =
      '{\n  // comment\n  "url": "https://example.test/*x*/",\n  /* block */ "a": [1, 2,],\n}';
    expect(JSON.parse(stripJsonc(text))).toEqual({ url: 'https://example.test/*x*/', a: [1, 2] });
  });
});

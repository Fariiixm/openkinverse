import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME, SharingScopeSchema } from './index.ts';

describe('@openkinverse/core smoke test', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@openkinverse/core');
  });

  it('accepts known sharing scopes and rejects unknown ones', () => {
    expect(SharingScopeSchema.parse('private')).toBe('private');
    expect(SharingScopeSchema.safeParse('everyone').success).toBe(false);
  });
});

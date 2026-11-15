import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, PACKAGE_NAME } from './index.ts';

describe('@openkinverse/mind smoke test', () => {
  it('exposes its package name and resolves @openkinverse/core', () => {
    expect(PACKAGE_NAME).toBe('@openkinverse/mind');
    expect(DEPENDS_ON).toEqual(['@openkinverse/core']);
  });
});

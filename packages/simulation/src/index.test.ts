import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, PACKAGE_NAME } from './index.ts';

describe('@openkinverse/simulation smoke test', () => {
  it('exposes its package name and resolves @openkinverse/core', () => {
    expect(PACKAGE_NAME).toBe('@openkinverse/simulation');
    expect(DEPENDS_ON).toEqual(['@openkinverse/core']);
  });
});

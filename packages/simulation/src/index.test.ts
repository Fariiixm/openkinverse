import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index.ts';

describe('@openkinverse/simulation smoke test', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@openkinverse/simulation');
  });
});

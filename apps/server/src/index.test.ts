import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, PACKAGE_NAME, buildServer } from './index.ts';

describe('@openkinverse/server smoke test', () => {
  it('resolves all internal workspace dependencies', () => {
    expect(PACKAGE_NAME).toBe('@openkinverse/server');
    expect(DEPENDS_ON).toEqual([
      '@openkinverse/core',
      '@openkinverse/simulation',
      '@openkinverse/mind',
    ]);
  });

  it('answers the health endpoint without binding a port', async () => {
    const app = buildServer();
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});

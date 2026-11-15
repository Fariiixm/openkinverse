#!/usr/bin/env node
// Verifies that plain Node.js (native type stripping, no build step, no
// loader) can import the server entry and every internal workspace it depends
// on, and that the app answers its health endpoint. Fails with exit code 1.

import { buildServer, DEPENDS_ON } from '../apps/server/src/index.ts';

const app = buildServer();
try {
  const response = await app.inject({ method: 'GET', url: '/health' });
  if (response.statusCode !== 200) {
    throw new Error(`/health returned ${String(response.statusCode)}`);
  }
  console.log(
    `Node ${process.version} imported @openkinverse/server via type stripping (deps: ${DEPENDS_ON.join(', ')}); /health -> 200`,
  );
} catch (error) {
  console.error('Node import smoke test failed:', error);
  process.exitCode = 1;
} finally {
  await app.close();
}

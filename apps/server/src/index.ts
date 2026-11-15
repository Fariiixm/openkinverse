import Fastify, { type FastifyInstance } from 'fastify';
import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@openkinverse/core';
import { PACKAGE_NAME as MIND_PACKAGE_NAME } from '@openkinverse/mind';
import { PACKAGE_NAME as SIMULATION_PACKAGE_NAME } from '@openkinverse/simulation';

/** Name of this package, used by smoke tests and diagnostics. */
export const PACKAGE_NAME = '@openkinverse/server';

/** Packages this app depends on, exposed to verify workspace wiring. */
export const DEPENDS_ON: readonly string[] = [
  CORE_PACKAGE_NAME,
  SIMULATION_PACKAGE_NAME,
  MIND_PACKAGE_NAME,
];

/**
 * Builds the Fastify app without binding a port. Placeholder until the
 * server implementation lands; it only exposes a liveness endpoint.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/health', () => ({ status: 'ok' }));
  return app;
}

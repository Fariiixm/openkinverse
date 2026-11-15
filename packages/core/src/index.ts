import { z } from 'zod';

/** Name of this package, used by smoke tests and diagnostics. */
export const PACKAGE_NAME = '@openkinverse/core';

/** Sharing scopes. Deny by default: anything unspecified is `private`. */
export const SharingScopeSchema = z.enum(['private', 'invited', 'public']);

export type SharingScope = z.infer<typeof SharingScopeSchema>;

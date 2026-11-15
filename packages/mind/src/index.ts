import { PACKAGE_NAME as CORE_PACKAGE_NAME } from '@openkinverse/core';

/** Name of this package, used by smoke tests and diagnostics. */
export const PACKAGE_NAME = '@openkinverse/mind';

/** Packages this package depends on, exposed to verify workspace wiring. */
export const DEPENDS_ON: readonly string[] = [CORE_PACKAGE_NAME];

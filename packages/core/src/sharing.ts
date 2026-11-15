import { z } from 'zod';
import { AnyIdSchema, GrantIdSchema, UserIdSchema, type UserId } from './ids.ts';

/**
 * Sharing scopes (ADR-0003).
 *
 * - `private`: only the owner.
 * - `invited`: the owner plus users holding an explicit grant for this resource.
 * - `public`: discoverable by anyone.
 *
 * Scope applies per resource. Unknown values are rejected, never coerced.
 */
export const SHARING_SCOPES = ['private', 'invited', 'public'] as const;

export const SharingScopeSchema = z.enum(SHARING_SCOPES);
export type SharingScope = z.infer<typeof SharingScopeSchema>;

export const DEFAULT_SHARING_SCOPE: SharingScope = 'private';

/**
 * Scope schema for creation inputs: an omitted (`undefined`) scope becomes
 * `private`. `null`, empty strings and unknown values are still rejected.
 * Use {@link SharingScopeSchema} when reading stored data, where a missing
 * scope is an error.
 */
export const SharingScopeInputSchema = SharingScopeSchema.default(DEFAULT_SHARING_SCOPE);

/**
 * Minimal access grant used by {@link canAccess}. The full grant model
 * (permissions, expiry, revocation) is defined in issue #22.
 */
export const AccessGrantSchema = z
  .object({
    id: GrantIdSchema,
    resourceId: AnyIdSchema,
    granteeId: UserIdSchema,
  })
  .strict();
export type AccessGrant = z.infer<typeof AccessGrantSchema>;

export interface ScopedResource {
  id: string;
  ownerId: string;
  /** Typed as `unknown` so callers cannot bypass validation; invalid values deny. */
  scope: unknown;
}

/**
 * Pure, deny-by-default read-access check.
 *
 * - Invalid resource IDs, owner IDs or scopes deny.
 * - The owner always has access.
 * - `public` resources are readable by anyone, including anonymous viewers.
 * - `invited` resources require a grant whose `resourceId` equals the resource
 *   ID and whose `granteeId` equals the viewer. Grants never transfer between
 *   resources (sharing a profile does not share memories).
 * - `private` resources are readable only by the owner.
 */
export function canAccess(
  resource: ScopedResource,
  grants: readonly AccessGrant[],
  viewer: UserId | null | undefined,
): boolean {
  const scope = SharingScopeSchema.safeParse(resource.scope);
  if (!scope.success) return false;
  if (!AnyIdSchema.safeParse(resource.id).success) return false;
  if (!UserIdSchema.safeParse(resource.ownerId).success) return false;

  const validViewer =
    viewer !== null && viewer !== undefined && UserIdSchema.safeParse(viewer).success;

  if (validViewer && viewer === resource.ownerId) return true;

  const resourceScope: SharingScope = scope.data;
  switch (resourceScope) {
    case 'public':
      return true;
    case 'invited':
      if (!validViewer) return false;
      return grants.some(
        (grant) =>
          AccessGrantSchema.safeParse(grant).success &&
          grant.resourceId === resource.id &&
          grant.granteeId === viewer,
      );
    case 'private':
      return false;
    default: {
      const exhaustive: never = resourceScope;
      return exhaustive;
    }
  }
}

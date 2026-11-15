/** Deterministic spatial helpers for room-relative positions. */
import type { ActivitySpot, Room, Vec2 } from './types.ts';

/** Euclidean distance. Uses `Math.sqrt`, which IEEE 754 requires to be correctly rounded. */
export function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function findSpot(room: Room, spotId: string): ActivitySpot | undefined {
  return room.spots.find((spot) => spot.id === spotId);
}

/**
 * Returns the spot supporting `activityId` that is closest to `from`.
 * Ties are broken by the spot order in the room definition.
 */
export function nearestSpotFor(
  room: Room,
  activityId: string,
  from: Vec2,
): ActivitySpot | undefined {
  let best: ActivitySpot | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const spot of room.spots) {
    if (!spot.activityIds.includes(activityId)) continue;
    const d = distance(from, spot.position);
    if (d < bestDistance) {
      best = spot;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Moves `from` toward `to` by at most `maxDistance` meters.
 * Returns the exact target once it is within reach, so arrival is exact.
 */
export function moveToward(
  from: Vec2,
  to: Vec2,
  maxDistance: number,
): { position: Vec2; arrived: boolean } {
  const d = distance(from, to);
  if (d <= maxDistance) return { position: { x: to.x, z: to.z }, arrived: true };
  const ratio = maxDistance / d;
  return {
    position: { x: from.x + (to.x - from.x) * ratio, z: from.z + (to.z - from.z) * ratio },
    arrived: false,
  };
}

export function isInsideRoom(room: Room, position: Vec2): boolean {
  return (
    position.x >= 0 && position.x <= room.widthM && position.z >= 0 && position.z <= room.depthM
  );
}

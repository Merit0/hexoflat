import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import router, { ROUTES } from '@/router';

/**
 * The store's only door to vue-router.
 *
 * Routing is an apps/web concern and must never follow the world rules into
 * packages/engine — keeping it behind these two functions means the store
 * talks about "go to this location", not about route names and params, and
 * the router import stops being spread through domain code.
 */

export function navigateToLocation(locationKey: LocationKey): void {
  void router
    .push({ name: ROUTES.WORLD, params: { locationKey } })
    .catch((e: unknown) => console.error('Router push failed:', e));
}

/**
 * True when the browser is currently showing some *other* world location, so
 * the caller has to route away rather than just swap the loaded map. Asking
 * this before pushing is what stops a redundant navigation to the route the
 * user is already on.
 */
export function isViewingOtherWorldLocation(locationKey: LocationKey): boolean {
  const current = router.currentRoute.value;
  return current.name === ROUTES.WORLD && current.params.locationKey !== locationKey;
}

export async function routeToLocation(locationKey: LocationKey): Promise<void> {
  await router.push({ name: ROUTES.WORLD, params: { locationKey } });
}

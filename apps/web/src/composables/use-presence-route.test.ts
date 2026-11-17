import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type Ref } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import {
  reportHeroElsewhere,
  reportMapAccepted,
  reportMapMismatch,
} from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';
import { usePresenceRoute } from './use-presence-route';

const goToLocation = vi.fn();
const reloadLocationMap = vi.fn<(locationKey: LocationKey) => Promise<boolean>>(() =>
  Promise.resolve(true),
);
const failWorldLoad = vi.fn();

vi.mock('@/stores/world-map-store', () => ({
  useWorldMapStore: () => ({
    goToLocation,
    reloadLocationMap,
    failWorldLoad,
    isShowing: () => false,
  }),
}));
vi.mock('@/services/world/location-navigator', () => ({
  replaceLocationRoute: vi.fn(async () => {}),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function standIn(locationKey: LocationKey) {
  inventorySession.presence = {
    locationKey,
    mapId: `${locationKey}-map`,
    coordinates: { columnIndex: 3, rowIndex: 3 },
  };
}

function showRoute(route: Ref<LocationKey | undefined>) {
  const app = createApp(
    defineComponent({
      setup() {
        usePresenceRoute(() => route.value);
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  return app;
}

describe('the world route follows the place the server holds', () => {
  beforeEach(() => {
    resetInventorySession();
    goToLocation.mockReset();
    vi.mocked(replaceLocationRoute).mockClear();
    reloadLocationMap.mockClear();
    failWorldLoad.mockClear();
  });

  it('silently replaces a link to another location with the location the hero stands in', () => {
    standIn('silesia');
    showRoute(ref<LocationKey | undefined>('cave'));
    expect(replaceLocationRoute).toHaveBeenCalledWith('silesia');
    expect(goToLocation).not.toHaveBeenCalled();
  });

  it('shows the linked location when the hero stands there', () => {
    standIn('cave');
    showRoute(ref<LocationKey | undefined>('cave'));
    expect(goToLocation).toHaveBeenCalledWith('cave');
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('shows the linked location while the server has no place for the hero yet', () => {
    showRoute(ref<LocationKey | undefined>('camping'));
    expect(goToLocation).toHaveBeenCalledWith('camping');
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('follows a route change only after the server has moved the hero there', async () => {
    standIn('silesia');
    const route = ref<LocationKey | undefined>('silesia');
    showRoute(route);
    standIn('camping');
    route.value = 'camping';
    await nextTick();
    expect(goToLocation).toHaveBeenLastCalledWith('camping');
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('reloads the held location and returns to it when the server refuses an entry elsewhere, and stops after unmount', async () => {
    standIn('silesia');
    const view = showRoute(ref<LocationKey | undefined>('silesia'));
    standIn('cave');
    reportHeroElsewhere();
    await settle();
    expect(reloadLocationMap).toHaveBeenCalledWith('cave');
    expect(replaceLocationRoute).toHaveBeenCalledWith('cave');
    view.unmount();
    vi.mocked(replaceLocationRoute).mockClear();
    reloadLocationMap.mockClear();
    reportHeroElsewhere();
    await settle();
    expect(reloadLocationMap).not.toHaveBeenCalled();
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('leaves the route alone when the refusal names the location already shown', async () => {
    standIn('silesia');
    showRoute(ref<LocationKey | undefined>('silesia'));
    reportHeroElsewhere();
    await settle();
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('joins a HERO_ELSEWHERE and a MAP_MISMATCH that arrive while one recovery runs (MAPFIX-6)', async () => {
    standIn('silesia');
    showRoute(ref<LocationKey | undefined>('silesia'));
    standIn('cave');
    reportHeroElsewhere();
    reportMapMismatch();
    reportHeroElsewhere();
    await settle();
    expect(reloadLocationMap).toHaveBeenCalledTimes(1);
    expect(reloadLocationMap).toHaveBeenCalledWith('cave');
    expect(failWorldLoad).not.toHaveBeenCalled();
  });

  describe('a command refused because the hero stands on another map (MAPFIX-2)', () => {
    it('reloads only the held location once', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledTimes(1);
      expect(reloadLocationMap).toHaveBeenCalledWith('silesia');
      expect(replaceLocationRoute).not.toHaveBeenCalled();
      expect(failWorldLoad).not.toHaveBeenCalled();
    });

    it('moves the route to the held location after the reload', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      standIn('camping');
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledWith('camping');
      expect(replaceLocationRoute).toHaveBeenCalledWith('camping');
    });

    it('REQ-7: a refusal after the reload shows the load error and reloads no more', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      reportMapMismatch();
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledTimes(1);
      reportMapMismatch();
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledTimes(1);
      expect(failWorldLoad).toHaveBeenCalledTimes(2);
    });

    it('a failed reload still counts as the one reload and raises nothing', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      reloadLocationMap.mockRejectedValueOnce(new Error('offline'));
      reportMapMismatch();
      await settle();
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledTimes(1);
      expect(failWorldLoad).toHaveBeenCalledTimes(1);
      expect(replaceLocationRoute).not.toHaveBeenCalled();
    });

    it('an accepted command on the shown map allows one reload again', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      reportMapMismatch();
      await settle();
      reportMapAccepted();
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).toHaveBeenCalledTimes(2);
      expect(failWorldLoad).not.toHaveBeenCalled();
    });

    it('does not reload without a held place or after unmount', async () => {
      const view = showRoute(ref<LocationKey | undefined>('camping'));
      reportMapMismatch();
      standIn('camping');
      view.unmount();
      reportMapMismatch();
      await settle();
      expect(reloadLocationMap).not.toHaveBeenCalled();
      expect(failWorldLoad).not.toHaveBeenCalled();
    });
  });
});

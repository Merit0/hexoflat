import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type Ref } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import { reportHeroElsewhere, reportMapMismatch } from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';
import { refetchServedWorld } from '@/services/world/served-world';
import { usePresenceRoute } from './use-presence-route';

const goToLocation = vi.fn();

vi.mock('@/stores/world-map-store', () => ({
  useWorldMapStore: () => ({ goToLocation }),
}));
vi.mock('@/services/world/location-navigator', () => ({
  replaceLocationRoute: vi.fn(async () => {}),
}));
vi.mock('@/services/world/served-world', () => ({
  refetchServedWorld: vi.fn(),
}));

function serverHolds(mapId: string | null) {
  vi.mocked(refetchServedWorld).mockResolvedValue(
    mapId ? ({ mapId } as Awaited<ReturnType<typeof refetchServedWorld>>) : null,
  );
}

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
    vi.mocked(refetchServedWorld).mockReset();
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

  it('returns to the held location when the server refuses an entry elsewhere, and stops after unmount', () => {
    standIn('silesia');
    const view = showRoute(ref<LocationKey | undefined>('silesia'));
    standIn('cave');
    reportHeroElsewhere();
    expect(replaceLocationRoute).toHaveBeenCalledWith('cave');
    view.unmount();
    vi.mocked(replaceLocationRoute).mockClear();
    reportHeroElsewhere();
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  it('leaves the route alone when the refusal names the location already shown', () => {
    standIn('silesia');
    showRoute(ref<LocationKey | undefined>('silesia'));
    reportHeroElsewhere();
    expect(replaceLocationRoute).not.toHaveBeenCalled();
  });

  describe('a command refused because the hero stands on another map (MAPFIX-2)', () => {
    it('reloads the held map of the same location and shows it', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      goToLocation.mockClear();
      serverHolds('silesia-map');
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).toHaveBeenCalledWith('silesia');
      expect(goToLocation).toHaveBeenCalledTimes(1);
      expect(goToLocation).toHaveBeenCalledWith('silesia');
      expect(replaceLocationRoute).not.toHaveBeenCalled();
    });

    it('reloads the held map of another location and moves the route there', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      goToLocation.mockClear();
      standIn('camping');
      serverHolds('camping-map');
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).toHaveBeenCalledWith('camping');
      expect(replaceLocationRoute).toHaveBeenCalledWith('camping');
      expect(goToLocation).not.toHaveBeenCalled();
    });

    it('shows nothing new when the reload fails or brings another map than the held one', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      goToLocation.mockClear();
      serverHolds(null);
      reportMapMismatch();
      await settle();
      serverHolds('older-map');
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).toHaveBeenCalledTimes(2);
      expect(goToLocation).not.toHaveBeenCalled();
      expect(replaceLocationRoute).not.toHaveBeenCalled();
    });

    it('reloads once for refusals that arrive while a reload runs, and again after it', async () => {
      standIn('silesia');
      showRoute(ref<LocationKey | undefined>('silesia'));
      goToLocation.mockClear();
      serverHolds('silesia-map');
      reportMapMismatch();
      reportMapMismatch();
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).toHaveBeenCalledTimes(1);
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).toHaveBeenCalledTimes(2);
    });

    it('does not reload without a held place or after unmount', async () => {
      const view = showRoute(ref<LocationKey | undefined>('camping'));
      reportMapMismatch();
      standIn('camping');
      view.unmount();
      reportMapMismatch();
      await settle();
      expect(refetchServedWorld).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick, ref, type Ref } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import { reportHeroElsewhere } from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';
import { usePresenceRoute } from './use-presence-route';

const goToLocation = vi.fn();

vi.mock('@/stores/world-map-store', () => ({
  useWorldMapStore: () => ({ goToLocation }),
}));
vi.mock('@/services/world/location-navigator', () => ({
  replaceLocationRoute: vi.fn(async () => {}),
}));

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
});

import { onBeforeUnmount, watch } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { useWorldMapStore } from '@/stores/world-map-store';
import {
  heldLocationKey,
  onHeroElsewhere,
  onMapMismatch,
} from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';
import { refetchServedWorld } from '@/services/world/served-world';
import { inventorySession } from '@/services/inventory/inventory-session';

export function usePresenceRoute(routeKey: () => LocationKey | undefined): void {
  const worldStore = useWorldMapStore();
  watch(
    routeKey,
    (key) => {
      if (!key) return;
      const held = heldLocationKey();
      if (held && held !== key) {
        void replaceLocationRoute(held);
        return;
      }
      if (!worldStore.isShowing(key)) worldStore.goToLocation(key);
    },
    { immediate: true },
  );
  onHeroElsewhere((held) => {
    if (held !== routeKey()) void replaceLocationRoute(held);
  });
  let reloading = false;
  onMapMismatch(() => {
    const held = heldLocationKey();
    if (!held || reloading) return;
    reloading = true;
    void refetchServedWorld(held)
      .then(async (served) => {
        if (!served || served.mapId !== inventorySession.presence?.mapId) return;
        if (held !== routeKey()) await replaceLocationRoute(held);
        else worldStore.goToLocation(held);
      })
      .finally(() => {
        reloading = false;
      });
  });
  onBeforeUnmount(() => {
    onHeroElsewhere(null);
    onMapMismatch(null);
  });
}

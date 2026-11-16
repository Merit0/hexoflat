import { onBeforeUnmount, watch } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { useWorldMapStore } from '@/stores/world-map-store';
import {
  heldLocationKey,
  onHeroElsewhere,
  onMapAccepted,
  onMapMismatch,
} from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';

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
  let reloaded = false;
  onMapMismatch(() => {
    const held = heldLocationKey();
    if (!held || reloading) return;
    if (reloaded) {
      worldStore.failWorldLoad();
      return;
    }
    reloading = true;
    reloaded = true;
    void worldStore
      .retryWorldLoad(held)
      .then(async () => {
        if (held !== routeKey()) await replaceLocationRoute(held);
      })
      .catch(() => undefined)
      .finally(() => {
        reloading = false;
      });
  });
  onMapAccepted(() => {
    if (!reloading) reloaded = false;
  });
  onBeforeUnmount(() => {
    onHeroElsewhere(null);
    onMapMismatch(null);
    onMapAccepted(null);
  });
}

import { onBeforeUnmount, watch } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { useWorldMapStore } from '@/stores/world-map-store';
import { heldLocationKey, onHeroElsewhere } from '@/services/world/presence-location';
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
      worldStore.goToLocation(key);
    },
    { immediate: true },
  );
  onHeroElsewhere((held) => {
    if (held !== routeKey()) void replaceLocationRoute(held);
  });
  onBeforeUnmount(() => onHeroElsewhere(null));
}

import { onBeforeUnmount, watch } from 'vue';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { HOME_LOCATION } from '@hexoflat/engine/world/enter-rule';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  arrivalTarget,
  heldLocationKey,
  onHeroElsewhere,
  onMapAccepted,
  onMapMismatch,
  onStaleAnswer,
} from '@/services/world/presence-location';
import { replaceLocationRoute } from '@/services/world/location-navigator';

export function usePresenceRoute(routeKey: () => LocationKey | undefined): void {
  const worldStore = useWorldMapStore();
  watch(
    routeKey,
    (key) => {
      if (!key || key === arrivalTarget()) return;
      const held = heldLocationKey();
      if (held && held !== key) {
        void replaceLocationRoute(held);
        return;
      }
      if (!worldStore.isShowing(key)) worldStore.goToLocation(key);
    },
    { immediate: true },
  );
  let recovery: Promise<void> | null = null;
  function recover(held: LocationKey): void {
    recovery ??= worldStore
      .reloadLocationMap(held)
      .then(async (applied) => {
        if (applied && held !== routeKey()) await replaceLocationRoute(held);
      })
      .catch(() => undefined)
      .finally(() => {
        recovery = null;
      });
  }
  onHeroElsewhere(recover);
  let reloaded = false;
  onMapMismatch(() => {
    const held = heldLocationKey();
    if (!held || recovery) return;
    if (reloaded) {
      worldStore.failWorldLoad();
      return;
    }
    reloaded = true;
    recover(held);
  });
  onMapAccepted(() => {
    if (!recovery) reloaded = false;
  });
  onStaleAnswer((mapId) => {
    if (mapId && mapId === worldStore.currentMapId) return;
    useHeroToolStore().stopTool();
    recover(heldLocationKey() ?? HOME_LOCATION);
  });
  onBeforeUnmount(() => {
    onStaleAnswer(null);
    onHeroElsewhere(null);
    onMapMismatch(null);
    onMapAccepted(null);
  });
}

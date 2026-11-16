import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LootFlightLayer } from '@/render/layers/loot-flight-layer';
import { containerOpenedOf, graveWalkLeadMs, planLootFlights } from '@/services/loot/loot-flight';
import { BATTLE_TIMING } from './battle-timing';
import {
  finishLootFlights,
  lootFlightRequest,
  startLootFlights,
} from '@/services/loot/loot-flight-state';

export interface GraveFlightsDeps {
  offsetOf: (hex: BattleHex) => IHexCoordinates;
  flightLayer: () => LootFlightLayer | null;
  onBusy: (busy: boolean) => void;
}

export function createGraveFlights(deps: GraveFlightsDeps) {
  let flightBusy = false;
  let animatorBusy = false;
  let cancelled = false;

  function report() {
    if (cancelled) return;
    deps.onBusy(flightBusy || animatorBusy);
  }

  return {
    setAnimatorBusy(busy: boolean) {
      animatorBusy = busy;
      report();
    },
    start(events: DomainEvent[]) {
      const played = containerOpenedOf(events, deps.offsetOf);
      if (!played) return;
      startLootFlights(planLootFlights(played, graveWalkLeadMs(events, BATTLE_TIMING.stepMs)));
      const request = lootFlightRequest.value;
      const layer = deps.flightLayer();
      if (!request || !layer) return;
      flightBusy = true;
      report();
      void layer.play(request).then(() => {
        finishLootFlights(request.id);
        flightBusy = false;
        report();
      });
    },
    cancel() {
      cancelled = true;
      flightBusy = false;
      finishLootFlights();
    },
  };
}

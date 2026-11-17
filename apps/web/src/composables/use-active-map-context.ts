import { computed, type ComputedRef } from 'vue';
import type { THexobject } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { TREASURE_SEEKER_MAP_KEY } from '@hexoflat/engine/registry/quest-map-key';
import { battleHexToOffset } from '@hexoflat/engine/battle/battlefield';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useBattleStore } from '@/stores/battle-store';
import { questRun } from '@/services/quests/quest-run-projection';
import { buildQuestField } from '@/services/quests/quest-field-model';
import { questHoverObject } from '@/services/quests/quest-hover-object';

export interface ActiveMapContext {
  kind: 'world' | 'quest' | 'battle';
  mapId: string | null;
  heroPosition: IHexCoordinates | null;
  objectAt(hex: IHexCoordinates): THexobject | null;
}

export function useActiveMapContext(): ComputedRef<ActiveMapContext> {
  const world = useWorldMapStore();
  const hero = useHeroStore();
  const battle = useBattleStore();
  const questField = computed(() => (questRun.value ? buildQuestField(questRun.value) : null));

  return computed(() => {
    if (battle.isOpen) {
      const controlled = battle.projection?.creatures.find(
        (creature) => creature.side === 'heroes' && battle.localHeroIds.includes(creature.id),
      );
      return {
        kind: 'battle',
        mapId: null,
        heroPosition:
          controlled && battle.deploy
            ? battleHexToOffset(battle.deploy.biome, controlled.pos)
            : null,
        objectAt: () => null,
      };
    }
    if (questRun.value) {
      return {
        kind: 'quest',
        mapId: TREASURE_SEEKER_MAP_KEY,
        heroPosition: questRun.value.position,
        objectAt: (hex: IHexCoordinates) => {
          const field = questField.value;
          return field ? questHoverObject(field, hex) : null;
        },
      };
    }
    return {
      kind: 'world',
      mapId: world.currentMapId,
      heroPosition: hero.heroCoordinates,
      objectAt: (hex: IHexCoordinates) => {
        const key = coordinateKey(hex);
        const tile = world.map?.tiles.find((tile) => coordinateKey(tile.coordinates) === key);
        return tile?.isRevealed ? tile.hexobject : null;
      },
    };
  });
}

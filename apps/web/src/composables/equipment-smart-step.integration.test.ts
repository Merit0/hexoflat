import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import { createKnowledgeState } from '@hexoflat/engine/knowledge/state';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { applyProgress } from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';
import { useMovePreview } from './use-move-preview';

const TARGET = { columnIndex: 1, rowIndex: 0 };

function setup() {
  const world = useWorldMapStore();
  const hero = useHeroStore();
  const inventory = useHeroInventoryStore();
  const map = new HexMapBuilder().name('smart-step').width(4).height(4).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  world.map = map;
  world.currentLocationKey = 'silesia';
  world.currentMapId = 'smart-step';
  hero.hero.id = 'hero-1';
  hero.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
  hero.loadKnowledge();
  applyProgress({
    revision: 1,
    state: { paidSteps: 4, knowledge: { ...createKnowledgeState('hero-1'), current: 0 } },
  });
  inventory.items = [
    {
      id: 'smart-step',
      key: 'shield',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      isNew: false,
      slotKey: 'eq:shield',
      token: {
        ...upcastToken('hero-1', 'smart-step', 'shield')!,
        attributes: [{ key: 'smart-step', value: 5 }],
      },
    },
  ];
  const preview = useMovePreview({
    hoveredTileCoord: ref(TARGET),
    getTileByCoord: (at) =>
      map.tiles.find(
        (tile) =>
          tile.coordinates.columnIndex === at.columnIndex &&
          tile.coordinates.rowIndex === at.rowIndex,
      ),
  });
  return { hero, inventory, map, preview };
}

describe('A04 Smart Step preview and server projection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('allows the free fifth step at zero Will in both planner and preview', () => {
    const { hero, map, preview } = setup();
    expect(inventorySession.paidSteps).toBe(4);
    expect(hero.paidSteps).toBe(4);
    expect(hero.planFreeRoamRoute(map, TARGET).affordable).toBe(true);
    expect(preview.reachable.value).toBe(true);
    applyProgress({ revision: 2, state: { paidSteps: 5, knowledge: hero.knowledge } });
    expect(hero.planFreeRoamRoute(map, TARGET).affordable).toBe(false);
    expect(preview.reachable.value).toBe(false);
  });

  it('reacts to bag/equipment swaps without resetting the server counter', () => {
    const { hero, inventory, map, preview } = setup();
    inventory.items[0].slotKey = 'bag:0';
    expect(hero.planFreeRoamRoute(map, TARGET).affordable).toBe(false);
    expect(preview.reachable.value).toBe(false);
    inventory.items[0].slotKey = 'eq:shield';
    expect(preview.reachable.value).toBe(true);
    inventory.items[0].token!.attributes = [{ key: 'smart-step', value: 3 }];
    expect(preview.reachable.value).toBe(false);
    expect(hero.paidSteps).toBe(4);
    hero.resetHero();
    expect(hero.paidSteps).toBe(0);
    expect(inventorySession.paidSteps).toBe(0);
  });
});

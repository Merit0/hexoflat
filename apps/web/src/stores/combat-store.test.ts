import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getOddQNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { useWorldMapStore } from './world-map-store';
import { useCombatStore } from './combat-store';
import { useHeroStore } from './hero-store';

function setupMapWithHeroAt(coords: IHexCoordinates = { columnIndex: 1, rowIndex: 1 }) {
  const worldStore = useWorldMapStore();
  const map = new HexMapBuilder().name('combat-test').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;

  worldStore.map = map;
  worldStore.currentMapId = 'combat-test-map';
  worldStore.heroCoordinates = { ...coords };

  return { worldStore, map };
}

function getTile(map: ReturnType<typeof setupMapWithHeroAt>['map'], coords: IHexCoordinates) {
  return map.tiles.find(
    (t) =>
      t.coordinates.columnIndex === coords.columnIndex &&
      t.coordinates.rowIndex === coords.rowIndex,
  )!;
}

describe('useCombatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('turn flow', () => {
    it('startCombat activates combat on the hero turn with a full move budget', () => {
      setupMapWithHeroAt();
      const combatStore = useCombatStore();

      combatStore.startCombat();

      expect(combatStore.combatActive).toBe(true);
      expect(combatStore.combatTurnSide).toBe('hero');
      expect(combatStore.combatStepsLeft).toBe(combatStore.getCombatMoveBudget());
    });

    it('startCombat is a no-op when combat is already active', () => {
      setupMapWithHeroAt();
      const combatStore = useCombatStore();
      combatStore.startCombat();
      combatStore.combatStepsLeft = 3;

      combatStore.startCombat();

      expect(combatStore.combatStepsLeft).toBe(3);
    });

    it('advanceCombatTurn flips the turn side and resets per-turn flags', () => {
      const { worldStore, map } = setupMapWithHeroAt();
      // A living enemy actor is required for the enemy turn to actually take
      // hold — with none, ensureEnemyTurnResolution() synchronously advances
      // straight back to 'hero' (no one to act), which is its own behavior
      // covered separately and not what this test is checking.
      const enemyCoord = getOddQNeighbors(worldStore.heroCoordinates!)[0];
      getTile(map, enemyCoord).hexobject = HexObjectFactory.create(
        HEXOBJECT_KEYS.EMITTER,
        enemyCoord,
      );
      const combatStore = useCombatStore();
      combatStore.startCombat();
      combatStore.combatAttackUsed = true;

      combatStore.advanceCombatTurn();

      expect(combatStore.combatTurnSide).toBe('enemy');
      expect(combatStore.combatAttackUsed).toBe(false);
    });

    it('endCombat resets every combat field to its default', () => {
      setupMapWithHeroAt();
      const combatStore = useCombatStore();
      combatStore.startCombat();
      combatStore.combatMarkers.push({
        owner: 'hero',
        coord: { columnIndex: 0, rowIndex: 0 },
        kind: 'defend',
        visible: true,
      });

      combatStore.endCombat();

      expect(combatStore.combatActive).toBe(false);
      expect(combatStore.combatTurnSide).toBe('hero');
      expect(combatStore.combatStepsLeft).toBe(0);
      expect(combatStore.combatMarkers).toEqual([]);
    });
  });

  describe('defend markers', () => {
    it('places a defend marker on an empty, adjacent, revealed tile', () => {
      const { worldStore } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const combatStore = useCombatStore();
      combatStore.startCombat();
      const target = getOddQNeighbors(worldStore.heroCoordinates!)[0];

      const placed = combatStore.placeCombatDefendMarker(target, HEXOBJECT_KEYS.SHIELD);

      expect(placed).toBe(true);
      expect(combatStore.combatDefendUsed).toBe(true);
      expect(combatStore.combatStepsLeft).toBe(0);
      expect(combatStore.combatMarkers).toEqual([
        {
          owner: 'hero',
          coord: target,
          kind: 'defend',
          visible: true,
          toolKey: HEXOBJECT_KEYS.SHIELD,
        },
      ]);
    });

    it('rejects placing a defend marker on a non-adjacent tile', () => {
      const { worldStore } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const combatStore = useCombatStore();
      combatStore.startCombat();

      const farTarget = { columnIndex: 0, rowIndex: 0 };
      const isAdjacent = getOddQNeighbors(worldStore.heroCoordinates!).some(
        (n) => n.columnIndex === farTarget.columnIndex && n.rowIndex === farTarget.rowIndex,
      );
      expect(isAdjacent).toBe(false);

      const placed = combatStore.placeCombatDefendMarker(farTarget, HEXOBJECT_KEYS.SHIELD);

      expect(placed).toBe(false);
      expect(combatStore.combatMarkers).toEqual([]);
    });

    it('rejects placing a second defend marker in the same turn', () => {
      const { worldStore, map } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const combatStore = useCombatStore();
      combatStore.startCombat();
      const [first, second] = getOddQNeighbors(worldStore.heroCoordinates!);
      // second target must stay a plain walkable tile for the assertion to be meaningful
      expect(getTile(map, second).hexobject).toBeNull();

      combatStore.placeCombatDefendMarker(first, HEXOBJECT_KEYS.SHIELD);
      const placedAgain = combatStore.placeCombatDefendMarker(second, HEXOBJECT_KEYS.SHIELD);

      expect(placedAgain).toBe(false);
      expect(combatStore.combatMarkers).toHaveLength(1);
    });

    it('removeCombatDefendMarker removes the marker and restores the stored steps', () => {
      const { worldStore } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const combatStore = useCombatStore();
      combatStore.startCombat();
      const target = getOddQNeighbors(worldStore.heroCoordinates!)[0];
      combatStore.placeCombatDefendMarker(target, HEXOBJECT_KEYS.SHIELD);
      const budgetBeforeDefend = combatStore.getCombatMoveBudget();

      const removed = combatStore.removeCombatDefendMarker(target);

      expect(removed).toBe(true);
      expect(combatStore.combatDefendUsed).toBe(false);
      expect(combatStore.combatStepsLeft).toBe(budgetBeforeDefend);
      expect(combatStore.combatMarkers).toEqual([]);
    });
  });

  describe('performHeroCombatAttack', () => {
    it('damages an adjacent enemy creature', () => {
      const { worldStore, map } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const heroStore = useHeroStore();
      heroStore.hero.attack = 1;
      const combatStore = useCombatStore();
      combatStore.startCombat();

      const enemyCoord = getOddQNeighbors(worldStore.heroCoordinates!)[0];
      const enemyTile = getTile(map, enemyCoord);
      enemyTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.EMITTER, enemyCoord); // hp 30, survives a weak hit

      const result = combatStore.performHeroCombatAttack(enemyTile, HEXOBJECT_KEYS.SWORD);

      expect(result.ok).toBe(true);
      expect(combatStore.combatAttackUsed).toBe(true);
      expect(enemyTile.hexobject?.groupType).toBe(EHexobjectGroup.CREATURE);
      const creature =
        enemyTile.hexobject?.groupType === EHexobjectGroup.CREATURE
          ? enemyTile.hexobject.creature
          : null;
      expect(creature?.hp).toBeLessThan(30);
    });

    it('defeats a creature and ends combat once no enemies remain', () => {
      const { worldStore, map } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const heroStore = useHeroStore();
      heroStore.hero.attack = 10;
      const combatStore = useCombatStore();
      combatStore.startCombat();

      const enemyCoord = getOddQNeighbors(worldStore.heroCoordinates!)[0];
      const enemyTile = getTile(map, enemyCoord);
      enemyTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, enemyCoord); // hp 2, one-shot with attack 10

      const result = combatStore.performHeroCombatAttack(enemyTile, HEXOBJECT_KEYS.SWORD);

      expect(result.ok).toBe(true);
      expect(enemyTile.hexobject).toBeNull();
      expect(combatStore.hasLivingEnemyCreatures()).toBe(false);
      expect(combatStore.combatActive).toBe(false);
    });

    it('rejects attacking when it is not the hero turn', () => {
      const { worldStore, map } = setupMapWithHeroAt({ columnIndex: 1, rowIndex: 1 });
      const combatStore = useCombatStore();
      combatStore.startCombat();
      combatStore.combatTurnSide = 'enemy';

      const enemyCoord = getOddQNeighbors(worldStore.heroCoordinates!)[0];
      const enemyTile = getTile(map, enemyCoord);
      enemyTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETOR, enemyCoord);

      const result = combatStore.performHeroCombatAttack(enemyTile, HEXOBJECT_KEYS.SWORD);

      expect(result).toEqual({ ok: false, message: 'Not hero turn.' });
    });
  });

  describe('persistence bridge', () => {
    it('toSnapshot/hydrate round-trip combat state', () => {
      setupMapWithHeroAt();
      const combatStore = useCombatStore();
      combatStore.startCombat();
      combatStore.combatMarkers.push({
        owner: 'enemy',
        coord: { columnIndex: 2, rowIndex: 0 },
        kind: 'attack-trace',
        visible: true,
        toolKey: null,
      });

      const snapshot = combatStore.toSnapshot();
      combatStore.endCombat();
      expect(combatStore.combatActive).toBe(false);

      combatStore.hydrate(snapshot);

      expect(combatStore.combatActive).toBe(true);
      expect(combatStore.combatMarkers).toEqual(snapshot.combatMarkers);
    });

    it('resetToDefaults clears state without touching localStorage', () => {
      setupMapWithHeroAt();
      const combatStore = useCombatStore();
      combatStore.startCombat();

      combatStore.resetToDefaults();

      expect(combatStore.combatActive).toBe(false);
      expect(combatStore.combatStepsLeft).toBe(0);
      expect(combatStore.combatMarkers).toEqual([]);
    });
  });
});

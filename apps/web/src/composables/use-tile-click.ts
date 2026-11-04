import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { i18n } from '@/i18n';
import { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { EHexobjectGroup, THexobject } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroStore } from '@/stores/hero-store';
import { crossExitIfStanding } from '@/composables/use-board-crossing';

function describeHexobject(hexobject: THexobject): string {
  switch (hexobject.groupType) {
    case EHexobjectGroup.CONSTRUCTION:
      return (
        `construction:${hexobject.hexobjectKey} ` +
        `locked=${!!hexobject.construction.isLocked} interactable=${hexobject.isInteractable}`
      );
    case EHexobjectGroup.RESOURCE:
      return (
        `resource:${hexobject.hexobjectKey} ` +
        `available=${hexobject.resource.isAvailable} amount=${hexobject.resource.amount ?? '?'}/${hexobject.resource.maxAmount}`
      );
    case EHexobjectGroup.CREATURE:
      return (
        `creature:${hexobject.hexobjectKey} ` +
        `faction=${hexobject.creature.faction ?? 'neutral'} hp=${hexobject.creature.hp}/${hexobject.creature.hpMax}`
      );
    case EHexobjectGroup.TOOL:
      return `tool:${hexobject.hexobjectKey}`;
    case EHexobjectGroup.LOOT:
      return `loot:${hexobject.hexobjectKey} stackable=${!!hexobject.loot.traits.stackable}`;
    case EHexobjectGroup.EQUIPMENT:
      return `equipment:${hexobject.hexobjectKey}`;
  }
}

function describeTile(tile: IHexTile): string {
  if (!tile.isRevealed) return 'fogged (unrevealed) — click will reveal it';
  if (!tile.hexobject) return 'empty (walkable) — click will move hero here';
  return describeHexobject(tile.hexobject);
}

function logTileClick(tile: IHexTile) {
  const { columnIndex, rowIndex } = tile.coordinates;
  console.log(`[tile-click] (${columnIndex}, ${rowIndex}) ${tile.tileId} — ${describeTile(tile)}`);
}

export function useTileClick() {
  const worldMapStore = useWorldMapStore();
  const battleStore = useBattleStore();
  const heroToolStore = useHeroToolStore();
  const heroStore = useHeroStore();

  async function handleTileClick(tile: IHexTile) {
    logTileClick(tile);

    if (battleStore.inBattle) {
      heroToolStore.setActionMessage(i18n.global.t('moveBlocked.inBattle'));
      return;
    }

    if (knowledgePanelMode.value) {
      await heroStore.moveHeroTo(tile.coordinates);
      return;
    }

    if (heroToolStore.isDragging) {
      heroToolStore.updateHover(tile.coordinates);

      return;
    }

    if (!tile.isRevealed) {
      worldMapStore.revealTile(tile.coordinates);
      return;
    }

    if (tile.hexobject) return;

    const moved = await heroStore.moveHeroTo(tile.coordinates);
    if (moved) await crossExitIfStanding();
  }

  return { handleTileClick };
}

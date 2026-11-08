import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTileClick } from './use-tile-click';

const tile = {
  coordinates: { columnIndex: 4, rowIndex: 6 },
  tileId: 'tile-4-6',
  isRevealed: true,
  hexobject: null,
} as unknown as IHexTile;

function setup() {
  setActivePinia(createPinia());
  knowledgePanelMode.value = null;
  const hero = useHeroStore();
  const move = vi.spyOn(hero, 'moveHeroTo').mockResolvedValue(false);
  return { move, tool: useHeroToolStore(), stash: useHeroStashStore() };
}

describe('tile click and the hand tool', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('walks the hero on a plain click', async () => {
    await useTileClick().handleTileClick(tile);
    expect(ctx.move).toHaveBeenCalledWith(tile.coordinates);
  });

  it('only moves the tool hover, not the hero, while a tool is active', async () => {
    ctx.tool.useTool(K.HAND, { columnIndex: 4, rowIndex: 5 });
    await useTileClick().handleTileClick(tile);
    expect(ctx.move).not.toHaveBeenCalled();
  });

  it('still walks the hero while the stash is open and the hand tool is working on the chest', async () => {
    ctx.tool.useTool(K.HAND, { columnIndex: 4, rowIndex: 5 });
    ctx.stash.open();
    await useTileClick().handleTileClick(tile);
    expect(ctx.move).toHaveBeenCalledWith(tile.coordinates);
  });

  it('walks while the Book of Will is open, as before', async () => {
    ctx.tool.useTool(K.HAND, { columnIndex: 4, rowIndex: 5 });
    knowledgePanelMode.value = 'hall';
    await useTileClick().handleTileClick(tile);
    expect(ctx.move).toHaveBeenCalledWith(tile.coordinates);
  });
});

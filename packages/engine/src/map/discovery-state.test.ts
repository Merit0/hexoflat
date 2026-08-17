import { describe, expect, it } from 'vitest';
import { HexTileModel } from './models/hex-tile-model';
import { HexTileBuilder } from './builders/hex-tile-builder';
import { promoteDiscovery } from './discovery-state';

describe('promoteDiscovery', () => {
  it('moves knowledge up the ladder and never down it (I10)', () => {
    expect(promoteDiscovery('UNKNOWN', 'OBSERVED')).toBe('OBSERVED');
    expect(promoteDiscovery('OBSERVED', 'DISCOVERED')).toBe('DISCOVERED');
    expect(promoteDiscovery('DISCOVERED', 'UNDERSTOOD')).toBe('UNDERSTOOD');

    expect(promoteDiscovery('DISCOVERED', 'OBSERVED')).toBe('DISCOVERED');
    expect(promoteDiscovery('UNDERSTOOD', 'DISCOVERED')).toBe('UNDERSTOOD');
    expect(promoteDiscovery('UNDERSTOOD', 'UNKNOWN')).toBe('UNDERSTOOD');
  });
});

describe('the isRevealed shim', () => {
  it('starts a tile unknown and therefore unrevealed', () => {
    const tile = new HexTileModel();

    expect(tile.discovery).toBe('UNKNOWN');
    expect(tile.isRevealed).toBe(false);
  });

  it('reads true for every state except UNKNOWN', () => {
    const tile = new HexTileModel();

    for (const state of ['OBSERVED', 'DISCOVERED', 'UNDERSTOOD'] as const) {
      tile.discovery = state;
      expect(tile.isRevealed, `${state} should read as revealed`).toBe(true);
    }

    tile.discovery = 'UNKNOWN';
    expect(tile.isRevealed).toBe(false);
  });

  it('promotes an unknown tile to DISCOVERED when written true', () => {
    // This is the exact call `combat-store.ts` makes when combat uncovers a
    // tile — the one place in the game where combat writes discovery state.
    const tile = new HexTileModel();
    tile.isRevealed = true;

    expect(tile.discovery).toBe('DISCOVERED');
  });

  it('upgrades an OBSERVED tile to DISCOVERED when written true', () => {
    const tile = new HexTileModel();
    tile.discovery = 'OBSERVED';
    tile.isRevealed = true;

    expect(tile.discovery).toBe('DISCOVERED');
  });

  it('does not demote an UNDERSTOOD tile', () => {
    // A boolean caller cannot express "the player now knows less", so it must
    // not be able to say it by accident. Camp is the tile this protects.
    const tile = new HexTileModel();
    tile.discovery = 'UNDERSTOOD';
    tile.isRevealed = true;

    expect(tile.discovery).toBe('UNDERSTOOD');
  });

  it('resets all the way to UNKNOWN when written false', () => {
    // initFog on a fogged map is the caller; hiding a tile again has to mean
    // hiding it completely, or fog would leak silhouettes.
    const tile = new HexTileModel();
    tile.discovery = 'UNDERSTOOD';
    tile.isRevealed = false;

    expect(tile.discovery).toBe('UNKNOWN');
    expect(tile.isRevealed).toBe(false);
  });
});

describe('HexTileBuilder', () => {
  it('builds an unknown tile by default', () => {
    const tile = new HexTileBuilder().coordinates({ columnIndex: 0, rowIndex: 0 }).build();

    expect(tile.discovery).toBe('UNKNOWN');
  });

  it('accepts a four-state discovery the boolean cannot express', () => {
    const tile = new HexTileBuilder()
      .coordinates({ columnIndex: 1, rowIndex: 1 })
      .discovery('OBSERVED')
      .build();

    expect(tile.discovery).toBe('OBSERVED');
    expect(tile.isRevealed).toBe(true);
  });

  it('lets discovery() win over isRevealed() regardless of call order', () => {
    const tile = new HexTileBuilder()
      .coordinates({ columnIndex: 2, rowIndex: 2 })
      .discovery('UNDERSTOOD')
      .isRevealed(true)
      .build();

    expect(tile.discovery).toBe('UNDERSTOOD');
  });

  it('does not leak a discovery between builds', () => {
    const builder = new HexTileBuilder();
    builder.coordinates({ columnIndex: 0, rowIndex: 0 }).discovery('UNDERSTOOD').build();
    const second = builder.coordinates({ columnIndex: 1, rowIndex: 0 }).build();

    expect(second.discovery).toBe('UNKNOWN');
  });
});

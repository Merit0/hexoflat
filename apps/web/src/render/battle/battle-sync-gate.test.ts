import { describe, expect, it } from 'vitest';
import type { BattleBoardScene } from './use-battle-board';
import type { BattleOverlayModel } from './battle-overlay-model';
import { createBattleSyncGate } from './battle-sync-gate';

const board = { '0,0': 'floor' } as BattleBoardScene['board'];
const boulders: BattleBoardScene['boulders'] = [];
const creatures = [] as BattleBoardScene['creatures'];

function scene(overrides: Partial<BattleBoardScene> = {}): BattleBoardScene {
  return { biome: 'crypt', board, boulders, creatures, activeId: 'hero', ...overrides };
}

function overlay(tone: 'shield' | 'ring' = 'ring', targets: string[] = []): BattleOverlayModel {
  return { marks: [{ hex: { q: 1, r: 0 }, tone }], targets };
}

describe('createBattleSyncGate', () => {
  it('rebuilds everything the first time', () => {
    expect(createBattleSyncGate().diff(scene(), overlay())).toEqual({
      board: true,
      overlay: true,
      tokens: true,
    });
  });

  it('rebuilds nothing when only the wrappers are new, as on every mouse hover', () => {
    const gate = createBattleSyncGate();
    gate.diff(scene(), overlay());
    expect(gate.diff(scene(), overlay())).toEqual({ board: false, overlay: false, tokens: false });
  });

  it('rebuilds only the part that changed', () => {
    const gate = createBattleSyncGate();
    const nextBoard = { ...board };
    const nextCreatures = [] as BattleBoardScene['creatures'];
    gate.diff(scene(), overlay());
    expect(gate.diff(scene({ board: nextBoard }), overlay())).toEqual({
      board: true,
      overlay: false,
      tokens: false,
    });
    expect(gate.diff(scene({ board: nextBoard }), overlay('shield'))).toEqual({
      board: false,
      overlay: true,
      tokens: false,
    });
    expect(
      gate.diff(scene({ board: nextBoard, creatures: nextCreatures }), overlay('shield')),
    ).toEqual({ board: false, overlay: false, tokens: true });
    expect(
      gate.diff(scene({ board: nextBoard, creatures: nextCreatures }), overlay('shield', ['s1'])),
    ).toEqual({ board: false, overlay: false, tokens: true });
  });
});

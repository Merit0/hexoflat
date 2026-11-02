import type { BattleBoardScene } from './use-battle-board';
import type { BattleOverlayModel } from './battle-overlay-model';

export interface BattleSyncDiff {
  board: boolean;
  overlay: boolean;
  tokens: boolean;
}

export function createBattleSyncGate() {
  let board: BattleBoardScene['board'] | null = null;
  let boulders: BattleBoardScene['boulders'] | null = null;
  let biome: BattleBoardScene['biome'] | null = null;
  let creatures: BattleBoardScene['creatures'] | null = null;
  let activeId: string | null | undefined;
  let targets = '';
  let overlayKey = '';

  return {
    diff(scene: BattleBoardScene, overlay: BattleOverlayModel): BattleSyncDiff {
      const boardChanged =
        scene.board !== board || scene.boulders !== boulders || scene.biome !== biome;
      const nextOverlayKey = JSON.stringify(overlay.marks);
      const nextTargets = overlay.targets.join(',');
      const tokensChanged =
        scene.creatures !== creatures || scene.activeId !== activeId || nextTargets !== targets;
      const overlayChanged = nextOverlayKey !== overlayKey;

      board = scene.board;
      boulders = scene.boulders;
      biome = scene.biome;
      creatures = scene.creatures;
      activeId = scene.activeId;
      targets = nextTargets;
      overlayKey = nextOverlayKey;
      return { board: boardChanged, overlay: overlayChanged, tokens: tokensChanged };
    },
  };
}

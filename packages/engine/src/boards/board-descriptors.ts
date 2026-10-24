export interface StaticBoardDescriptor {
  kind: 'STATIC';
  id: string;
  /** Absent for a STATIC board with no drawing to compare against (camping's WorldGenerator config) — such a board never triggers the "drawing changed, rebuild" rule. */
  drawingHash?: string;
}

export interface DungeonBoardDescriptor {
  kind: 'DUNGEON';
  presetId: string;
  seed: string;
  attempt: number;
  layoutId: string;
  chunkByZone: Record<string, string>;
}

export interface RecipeBoardDescriptor {
  kind: 'RECIPE';
  recipeId: string;
  version: number;
  seed: string;
  params: Record<string, unknown>;
  attempt: number;
}

export type BoardDescriptor =
  StaticBoardDescriptor | DungeonBoardDescriptor | RecipeBoardDescriptor;

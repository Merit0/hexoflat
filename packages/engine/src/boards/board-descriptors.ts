export interface StaticBoardDescriptor {
  kind: 'STATIC';
  id: string;
  drawingHash: string;
}

export interface DungeonBoardDescriptor {
  kind: 'DUNGEON';
  presetId: string;
  seed: string;
  attempt: number;
  layoutId: string;
  chunkByZone: Record<string, string>;
}

export type BoardDescriptor = StaticBoardDescriptor | DungeonBoardDescriptor;

import type { IHexCoordinates } from '../../map/interfaces/hex-tile-config-interface';
import type { EntrySide } from './embedder/orientation';

/**
 * Every hex the embedder places is either owned by a graph node/edge or is
 * an anonymous `SHELL` cell — there is no third option (D-rule §2.6.1:
 * "a hex has no reason to exist" no longer applies to a shell cell, because
 * the shell's reason IS being the boundary, not a path). `passable` is
 * tracked separately from ownership: an `OBSTRUCTION` node's hex is owned
 * (it exists for a reason, it's on the board) but not walkable, exactly
 * like a `SHELL` cell — the difference is only whether it's explained by
 * the graph or is pure boundary.
 */
export type EmbeddedHexOwner =
  { kind: 'NODE'; nodeId: string } | { kind: 'EDGE'; edgeId: string } | { kind: 'SHELL' };

export interface EmbeddedHex {
  coordinates: IHexCoordinates;
  owner: EmbeddedHexOwner;
  passable: boolean;
}

export interface EmbeddedPortal {
  nodeId: string;
  coordinates: IHexCoordinates;
}

export interface EmbeddedBoard {
  boardColumns: number;
  boardRows: number;
  /**
   * Only the used footprint plus its one-cell shell — everything else in
   * `[0, boardColumns) x [0, boardRows)` is implicit "deep unknown": never
   * placed here, never rendered (D10). There is no rectangle to punch holes
   * in, because the rectangle was never filled in the first place.
   */
  hexes: EmbeddedHex[];
  portals: EmbeddedPortal[];
  /** Which board side the graph's ENTRY was oriented toward (D19) — diagnostic, not consumed by the linter or growth itself. */
  entrySide: EntrySide;
}

export type EmbedResult = { ok: true; board: EmbeddedBoard } | { ok: false; reason: string };

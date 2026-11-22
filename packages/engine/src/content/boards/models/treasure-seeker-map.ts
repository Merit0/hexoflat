import { EDimension } from '../../../dimensions/dimensions';
import type { BoardRecipeInput } from '../recipe-schema';

export const TREASURE_SEEKER_MAP_MODEL = {
  id: 'treasure-seeker-map',
  dimension: EDimension.EARTH,
  foreignPlacements: [],
  version: 1,
  kind: 'generated',
  layout: 'extended',
  frame: { columns: 32, rows: 24 },
  background: '/hex-assets/board-hexes/stone-hex.png',
  fog: 'FOG',
  stages: {
    form: [{ kind: 'seeker-field', center: { q: 12, r: 12 }, radius: 6, edgeGapChance: 0.35 }],
    bounds: [{ kind: 'seeker-border', center: { q: 12, r: 12 }, radius: 7 }],
    gates: [{ kind: 'seeker-camp' }],
  },
} satisfies BoardRecipeInput;

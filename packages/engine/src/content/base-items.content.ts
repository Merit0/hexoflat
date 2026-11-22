import { deepFreeze } from '../utils/freeze/deep-freeze';
import { EDimension } from '../dimensions/dimensions';
import type { BaseItemDefinition } from '../tokens/base-item';

// These are separate authored items. Shared type mechanics do not grant cross-dimension ownership.
export const BASE_ITEMS: readonly BaseItemDefinition[] = deepFreeze([
  { key: 'earth-sword', dimension: EDimension.EARTH, type: 'sword' },
  { key: 'earth-shield', dimension: EDimension.EARTH, type: 'shield' },
  { key: 'earth-axe', dimension: EDimension.EARTH, type: 'axe' },
  { key: 'earth-pickaxe', dimension: EDimension.EARTH, type: 'pickaxe' },
  { key: 'underworld-sword', dimension: EDimension.UNDERWORLD, type: 'sword' },
  { key: 'underworld-shield', dimension: EDimension.UNDERWORLD, type: 'shield' },
  { key: 'underworld-axe', dimension: EDimension.UNDERWORLD, type: 'axe' },
  { key: 'underworld-pickaxe', dimension: EDimension.UNDERWORLD, type: 'pickaxe' },
  { key: 'heaven-sword', dimension: EDimension.HEAVEN, type: 'sword' },
  { key: 'heaven-shield', dimension: EDimension.HEAVEN, type: 'shield' },
  { key: 'heaven-axe', dimension: EDimension.HEAVEN, type: 'axe' },
  { key: 'heaven-pickaxe', dimension: EDimension.HEAVEN, type: 'pickaxe' },
]);

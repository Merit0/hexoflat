import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { TBaseRealm, TTokenOrigin } from './token-keys';

export type TLightTone = `${TBaseRealm}-${TTokenOrigin}` | 'god-executor-unique';

export const LIGHT_TONES: readonly TLightTone[] = [
  'gloom-base',
  'gloom-unique',
  'idol-base',
  'idol-unique',
  'spark-base',
  'spark-unique',
  'god-executor-unique',
];

export function lightTone(origin: TTokenOrigin, rarity: ERarityKind): TLightTone {
  if (rarity !== ERarityKind.GOD_EXECUTOR) return `${rarity}-${origin}`;
  if (origin === 'base') throw new Error('god-executor tokens are unique only');
  return 'god-executor-unique';
}

export type TLightColor = 'blue' | 'violet' | 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export const LIGHT_COLOR_BY_TONE: Readonly<Record<TLightTone, TLightColor>> = {
  'gloom-base': 'blue',
  'gloom-unique': 'violet',
  'idol-base': 'gray',
  'idol-unique': 'green',
  'spark-base': 'yellow',
  'spark-unique': 'orange',
  'god-executor-unique': 'red',
};

export function lightFrameFile(tone: TLightTone): string {
  return `${LIGHT_COLOR_BY_TONE[tone]}-light.png`;
}

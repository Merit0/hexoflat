import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { hexDistance } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { pickRandom } from '../utils/random';
import type {
  FrontierPromise,
  TWorldPromiseStrength,
  TWorldPromiseType,
} from '../content/world-section-schema';
import type { OpenSeam } from './world-map-assembler';
import type { WorldMapMvpConfig } from './world-map-config';

const TYPE_POOLS: Record<TWorldPromiseStrength, TWorldPromiseType[]> = {
  STRONG: ['LANDMARK_SILHOUETTE', 'OBELISK_FRAGMENT'],
  MEDIUM: ['STONE_FORMATION', 'GLOW', 'SMOKE', 'OLD_PATH'],
  SUBTLE: ['VEGETATION_SIGNAL', 'STREAM', 'FRACTURE_SIGNAL'],
};

function strengthFor(index: number, total: number, rng: () => number): TWorldPromiseStrength {
  if (index === 0) return rng() < 0.35 ? 'MEDIUM' : 'STRONG';
  if (index === 1 && total > 2) return 'MEDIUM';
  return 'SUBTLE';
}

export function placePromises(
  openSeams: OpenSeam[],
  campAnchor: IHexCoordinates,
  seed: string,
  config: WorldMapMvpConfig,
): FrontierPromise[] {
  if (openSeams.length === 0) return [];

  const rng = deriveStream(seed, 'promises');
  const upper = Math.min(config.maxPromises, openSeams.length);
  const lower = Math.min(config.requiredPromises, upper);
  const count = lower + Math.floor(rng() * (upper - lower + 1));

  const ordered = [...openSeams].sort(
    (a, b) => hexDistance(b.coord, campAnchor) - hexDistance(a.coord, campAnchor),
  );

  return ordered.slice(0, count).map((seam, i) => {
    const strength = strengthFor(i, count, rng);
    return {
      id: `promise-${i}`,
      type: pickRandom(TYPE_POOLS[strength], rng) as TWorldPromiseType,
      strength,
      seam: { coord: { ...seam.coord }, dir: seam.dir },
    };
  });
}

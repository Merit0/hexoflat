import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { MapDefinition } from '@hexoflat/engine/registry/world-map-registry';
import type { WorldValidation } from '@hexoflat/engine';

export type WorldDescriptor = {
  seed: string;
  archetype: string;
  versionId: string;
  validation: WorldValidation;
};

export interface BuiltWorld {
  map: HexMapModel;
  descriptor: WorldDescriptor | null;
}

export function resolveWorldMap(def: MapDefinition, seed: string): BuiltWorld {
  if (!def.generate) {
    return { map: def.create(seed), descriptor: null };
  }

  const result = def.generate(seed);
  return {
    map: result.map,
    descriptor: {
      seed: result.seed,
      archetype: result.archetype,
      versionId: result.versionId,
      validation: result.validation,
    },
  };
}

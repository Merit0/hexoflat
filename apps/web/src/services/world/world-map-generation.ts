import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { MapDefinition } from '@hexoflat/engine/registry/world-map-registry';
import type {
  FrontierPromise,
  GameplayAnchor,
  TWorldArchetypeKey,
  WorldValidation,
} from '@hexoflat/engine';

export type WorldDescriptor = {
  seed: string;
  archetype: string;
  versionId: string;
  validation: WorldValidation;
  promises: FrontierPromise[];
  anchors: GameplayAnchor[];
  attempts: number;
};

export interface BuiltWorld {
  map: HexMapModel;
  descriptor: WorldDescriptor | null;
}

function toDescriptor(result: ReturnType<NonNullable<MapDefinition['generate']>>): WorldDescriptor {
  return {
    seed: result.seed,
    archetype: result.archetype,
    versionId: result.versionId,
    validation: result.validation,
    promises: result.promises,
    anchors: result.anchors,
    attempts: result.attempts,
  };
}

export function resolveWorldMap(def: MapDefinition, seed: string, archetype?: string): BuiltWorld {
  if (!def.generate) {
    return { map: def.create(seed), descriptor: null };
  }
  const result = def.generate(seed, archetype as TWorldArchetypeKey | undefined);
  return { map: result.map, descriptor: toDescriptor(result) };
}

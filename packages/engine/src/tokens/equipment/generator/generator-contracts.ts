import type { RandomNumberGenerator } from '../../../utils/random';
import type { TMapTier } from '../../token-keys';
import type { TokenAttribute } from '../../token-schema';
import type { AttributeProfile } from '../attribute-profile-schema';
import type { TItemGroup } from '../equipment-keys';
import type { EquipmentTypeDefinition } from '../equipment-type-schema';

export type RandomStreams = (label: string) => RandomNumberGenerator;

export type AttributeTypeTarget = Pick<EquipmentTypeDefinition, 'key' | 'tool'>;

export interface AttributeGenerationContext {
  level: TMapTier;
  group: TItemGroup;
  type: AttributeTypeTarget;
  tokenId: string;
  rng: RandomStreams;
}

export interface ValueRange {
  min: number;
  max: number;
  step: number;
}

export interface PoolEntry extends ValueRange {
  key: string;
  weight: number;
}

export interface PoolRequest {
  profile: AttributeProfile;
  group: TItemGroup;
  type: AttributeTypeTarget;
}

export interface CountRequest {
  countWeights: readonly number[];
  maxCount: number;
  poolSize: number;
}

export interface IAttributeGenerator {
  generate(ctx: AttributeGenerationContext): TokenAttribute[];
}

export interface IAttributeProfileProvider {
  profileFor(level: TMapTier): AttributeProfile;
}

export interface IAttributePoolFilter {
  poolFor(request: PoolRequest): PoolEntry[];
}

export interface ICountRoller {
  roll(request: CountRequest, rng: RandomNumberGenerator): number;
}

export interface IWeightedPicker {
  pick(weights: readonly number[], rng: RandomNumberGenerator): number | null;
}

export interface IValueRoller {
  roll(range: ValueRange, rng: RandomNumberGenerator): number;
}

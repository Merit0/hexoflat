import { sha256Hex } from '../utils/hash/sha256';
import { ATTRIBUTE_STREAM_LABELS } from './equipment/generator/attribute-streams';
import type { RandomStreams } from './equipment/generator/generator-contracts';
import { SteppedValueRoller } from './equipment/generator/value-roller';
import { UNIQUE_INSTANCE_ID_LENGTH, type UniqueInstanceId } from './token-keys';
import type { AuthoredAttribute } from './unique-schema';

const VALUES = new SteppedValueRoller();

export function uniqueInstanceId(seed: string, tokenId: string): UniqueInstanceId {
  return sha256Hex(`unique-instance:${seed}:${tokenId}`).slice(0, UNIQUE_INSTANCE_ID_LENGTH);
}

export function rollAuthoredAttributes(
  authored: readonly AuthoredAttribute[],
  tokenId: string,
  rng: RandomStreams,
): { key: string; value: number }[] {
  return authored.map(({ attribute, min, max }) => ({
    key: attribute,
    value: VALUES.roll(
      { min, max, step: 1 },
      rng(ATTRIBUTE_STREAM_LABELS.authored(tokenId, attribute)),
    ),
  }));
}

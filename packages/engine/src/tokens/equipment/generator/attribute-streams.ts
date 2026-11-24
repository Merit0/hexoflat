import { deriveStream } from '../../../utils/random-seeded';
import type { RandomStreams } from './generator-contracts';

export const ATTRIBUTE_STREAM_LABELS = {
  count: (tokenId: string): string => `token:${tokenId}:attr:count`,
  pick: (tokenId: string, index: number): string => `token:${tokenId}:attr:pick:${index}`,
  value: (tokenId: string, key: string): string => `token:${tokenId}:attr:value:${key}`,
  authored: (tokenId: string, key: string): string => `token:${tokenId}:attr:authored:${key}`,
} as const;

export function seededRandomStreams(seed: string): RandomStreams {
  return (label) => deriveStream(seed, label);
}

import { describe, expect, it } from 'vitest';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { DEFAULT_HAND_MS, questHandDurationMs } from './quest-hand-duration';

const START = axialToOffset(FIELD_CENTER);
const [near] = getHexNeighbors(START);

describe('the hand takes as long here as on the world map', () => {
  it('uses the content duration, falling back to the default for a stack', () => {
    const run = {
      collect: { ground: [{ hex: near, itemKey: 'coins', amount: 2 }], seen: [near] },
    } as unknown as QuestProjection;
    expect(questHandDurationMs(run, near, 'take')).toBeGreaterThan(0);
    expect(questHandDurationMs({} as QuestProjection, near, 'take')).toBe(DEFAULT_HAND_MS);
    expect(questHandDurationMs({} as QuestProjection, near, 'eye')).toBeGreaterThan(0);
  });
});

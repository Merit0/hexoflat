import { describe, expect, it } from 'vitest';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { spriteKeyOf, spritePathOf } from './quest-board-model';

describe('quest hex sprites', () => {
  it.each([
    ['woodcutter', 'tree'],
    ['stonebreaker', 'rock'],
    ['scholar', 'knowledge-book'],
    ['bone-hunter', 'lone-skeleton'],
    ['seeker-1', 'camping-entrance'],
  ])('%s uses the %s hex', (id, key) => {
    expect(spriteKeyOf(ALL_QUESTS[id])).toBe(key);
  });

  it('gives every quest a real sprite file path', () => {
    for (const quest of Object.values(ALL_QUESTS)) {
      expect(spritePathOf(quest)).toMatch(/^\/.+\.png$/);
    }
  });
});

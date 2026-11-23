import { describe, expect, it } from 'vitest';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { capQuests, categoryOf, spriteKeyOf, spritePathOf } from './quest-board-model';

describe('quest hex sprites', () => {
  it.each([
    ['woodcutter', 'tree'],
    ['stonebreaker', 'rock'],
    ['scholar', 'knowledge-book'],
    ['bone-hunter', 'lone-skeleton'],
    ['seeker-1', 'camping-entrance'],
  ])('%s uses the %s hex', (id, key) => {
    expect(spriteKeyOf(id, categoryOf(ALL_QUESTS[id]))).toBe(key);
  });

  it('gives every quest a real sprite file path', () => {
    for (const quest of Object.values(ALL_QUESTS)) {
      expect(spritePathOf(quest.id, categoryOf(quest))).toMatch(/^\/.+\.png$/);
    }
  });
});

describe('board quest cap', () => {
  it('keeps taken quests first and shows at most seven in total', () => {
    const rows = [
      { id: 'a', taken: false },
      { id: 'b', taken: false },
      { id: 'c', taken: false },
      { id: 'd', taken: false },
      { id: 'e', taken: false },
      { id: 'f', taken: false },
      { id: 'g', taken: false },
      { id: 'h', taken: true },
    ];
    const capped = capQuests(rows);
    expect(capped).toHaveLength(7);
    expect(capped[0].id).toBe('h');
  });
});

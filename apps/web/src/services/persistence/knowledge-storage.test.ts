import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKnowledgeState } from '@hexoflat/engine/knowledge/state';
import { KNOWLEDGE_RULES } from '@hexoflat/engine/knowledge/math';
import { applyKnowledgeCommand } from '@hexoflat/engine/knowledge/reducer';
import { readKnowledge, transactKnowledge, writeKnowledge } from './knowledge-storage';

describe('knowledge persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    let tail = Promise.resolve();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (_key: string, callback: () => unknown) => {
          const next = tail.then(callback);
          tail = next.then(
            () => undefined,
            () => undefined,
          );
          return next;
        },
      },
    });
  });
  it('migrates only absent wallets and isolates hero identities', () => {
    expect(readKnowledge('one').current).toBe(KNOWLEDGE_RULES.startingWill);
    const state = createKnowledgeState('one');
    state.current = 12;
    writeKnowledge(state);
    expect(readKnowledge('one').current).toBe(12);
    expect(readKnowledge('two').current).toBe(KNOWLEDGE_RULES.startingWill);
  });
  it('preserves corrupt records for recovery instead of resetting them', () => {
    localStorage.setItem('hexoflat:knowledge:v1:one', '{invalid');
    expect(() => readKnowledge('one')).toThrow();
    expect(localStorage.getItem('hexoflat:knowledge:v1:one')).toBe('{invalid');
  });
  it('serializes concurrent commands and rejects a stale revision', async () => {
    const state = createKnowledgeState('one');
    state.current = 2;
    writeKnowledge(state);
    const ctx = {
      locationKey: 'silesia',
      willZone: 'paid' as const,
      mapId: 'world',
      combatActive: false,
      moving: true,
      atBook: false,
    };
    const spend = () =>
      transactKnowledge(
        'one',
        (saved) =>
          applyKnowledgeCommand(
            saved,
            {
              type: 'KNOWLEDGE',
              payload: { heroId: 'one', revision: 0, action: { kind: 'step' } },
            },
            ctx,
          )[0].type === 'KNOWLEDGE_CHANGED',
      );
    await Promise.all([spend(), spend()]);
    expect(readKnowledge('one').current).toBe(1);
    expect(readKnowledge('one').revision).toBe(1);
  });
  it('propagates failed writes without publishing a successful transaction', async () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await expect(
      transactKnowledge('one', (state) => {
        state.current = 0;
        return true;
      }),
    ).rejects.toThrow('quota');
    spy.mockRestore();
    expect(readKnowledge('one').current).toBe(KNOWLEDGE_RULES.startingWill);
  });
});

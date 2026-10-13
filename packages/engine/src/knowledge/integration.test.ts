import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  type HexEngineState,
  type HexEngineActionContext,
} from '../commands/apply-command';
import { serializeState, deserializeState, SnapshotChecksumError } from '../commands/snapshot';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { createKnowledgeState } from './state';
import { KNOWLEDGE_RULES, effectiveWillCapacity, travelStepBudget } from './math';

function stateFixture(): HexEngineState {
  const map = new HexMapBuilder().name('world').width(3).height(3).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return {
    map,
    heroes: {},
    knowledge: createKnowledgeState('hero'),
    knowledgeContext: {
      locationKey: 'silesia',
      willZone: 'paid',
      mapId: 'world',
      combatActive: false,
      moving: true,
      atBook: false,
      coordinates: { columnIndex: 0, rowIndex: 0 },
    },
  };
}

const paid = { willZone: 'paid', combatActive: false } as const;
const free = { willZone: 'free', combatActive: false } as const;

describe('knowledge engine integration', () => {
  it('validates each movement destination and saves a receipt with its charge', () => {
    const state = stateFixture();
    const ctx = {} as HexEngineActionContext;
    const dispatch = (columnIndex: number) =>
      applyCommand(
        state,
        {
          type: 'KNOWLEDGE',
          payload: {
            heroId: 'hero',
            revision: state.knowledge!.revision,
            action: { kind: 'step', target: { columnIndex, rowIndex: 0 } },
          },
        },
        ctx,
      );
    expect(dispatch(2).events[0].type).toBe('KNOWLEDGE_REJECTED');
    expect(state.knowledge!.current).toBe(KNOWLEDGE_RULES.startingWill);
    expect(dispatch(1).events[0].type).toBe('KNOWLEDGE_CHANGED');
    expect(state.knowledge!.current).toBe(KNOWLEDGE_RULES.startingWill - 1);
    expect(state.knowledge!.lastStep).toEqual({
      mapId: 'world',
      columnIndex: 1,
      rowIndex: 0,
      revision: 1,
    });
  });
  it('round-trips the wallet in engine snapshots and checks its checksum', () => {
    const state = stateFixture();
    state.knowledge!.current = 9;
    const snapshot = serializeState(state);
    expect(deserializeState(snapshot, 0).knowledge).toEqual(state.knowledge);
    snapshot.knowledge = { ...snapshot.knowledge!, current: 10 };
    expect(() => deserializeState(snapshot, 0)).toThrow(SnapshotChecksumError);
  });
  it('uses capacity and actual Will for travel', () => {
    expect(effectiveWillCapacity(50, [{ source: 'future-item', additionalCapacity: 10 }])).toBe(60);
    expect(travelStepBudget(5, 2, paid)).toBe(2);
    expect(travelStepBudget(5, 0, free)).toBe(5);
  });
});

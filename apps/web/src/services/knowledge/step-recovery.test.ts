import { describe, expect, it } from 'vitest';
import { createKnowledgeState } from '@hexoflat/engine/knowledge/state';
import { recoverStepPosition } from './step-recovery';

describe('recoverStepPosition', () => {
  const state = createKnowledgeState('hero');
  state.lastStep = { mapId: 'map-1', columnIndex: 4, rowIndex: 7, revision: 5 };

  it('gives the last confirmed step when the saved map is older than it', () => {
    expect(recoverStepPosition(state, 'map-1', 4)).toEqual({ columnIndex: 4, rowIndex: 7 });
  });

  it('gives nothing for another map, an up to date save or no knowledge', () => {
    expect(recoverStepPosition(state, 'map-2', 4)).toBeNull();
    expect(recoverStepPosition(state, 'map-1', 5)).toBeNull();
    expect(recoverStepPosition(null, 'map-1')).toBeNull();
  });
});

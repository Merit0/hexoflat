import { describe, expect, it } from 'vitest';
import type { HexEngineActionContext, HexEngineState } from '@hexoflat/engine';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { GameEngineService } from './game-engine.service';

describe('GameEngineService', () => {
  it('delegates to the real @hexoflat/engine applyCommand', () => {
    const service = new GameEngineService();
    const state: HexEngineState = { map: new HexMapModel() };
    // ADD_RESOURCE_SPAWNER against an empty map never reads ctx — no tile is
    // found, so the port stubs the full IActionContext would require are
    // never touched at runtime.
    const ctx = {} as unknown as HexEngineActionContext;

    const result = service.dispatch(
      state,
      {
        type: 'ADD_RESOURCE_SPAWNER',
        payload: {
          coordinates: { columnIndex: 0, rowIndex: 0 },
          hexobject: { hexobjectKey: 'tree' },
        },
      },
      ctx,
    );

    expect(result.events).toEqual([
      {
        type: 'RESOURCE_SPAWNER_REJECTED',
        payload: {
          coordinates: { columnIndex: 0, rowIndex: 0 },
          message: 'No tile at coordinates.',
        },
      },
    ]);
  });
});

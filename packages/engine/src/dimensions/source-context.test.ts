import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { applyCommand } from '../commands/apply-command';
import { createContext, toState } from '../commands/command-test-context';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import HexMapModel from '../map/models/hex-map-model';
import { cloneWorldField } from '../quests/cloned-field';
import { seekerFieldSchema } from '../quests/quest-state';
import { questDropContext } from '../quests/quest-drop-context';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  worldDropContext,
} from '../world/server-world';
import { hexAction, lifecycle, squadWorld } from '../squads/squad-test-setup';
import { heroBattleCreature } from '../squads/squad-battle';
import { battleStateSchema } from '../battle/battle-state';
import { EDimension } from './dimensions';

describe('captured dimension context', () => {
  it('preserves a world and cloned quest source through descriptor changes and reload', () => {
    const world = createServerWorld('cave', 'source-map', 'source-seed', 'hero');
    world.dropContext = { tokenType: ETokenType.GLOOM, mapTier: 3 };
    const field = cloneWorldField(world, world.heroCoordinates!);
    world.descriptor = null;
    const restored = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
    expect(worldDropContext(restored)).toEqual({ tokenType: 'gloom', mapTier: 3 });
    const savedField = seekerFieldSchema.parse(JSON.parse(JSON.stringify(field)));
    savedField.mapTier = 1;
    expect(questDropContext({ field: savedField })).toEqual({ tokenType: 'gloom', mapTier: 3 });
    expect(
      worldDropContext(createServerWorld('camping', 'camp', 'source-seed', 'hero')).tokenType,
    ).toBe('idol');
    expect(questDropContext({ field: savedField }).tokenType).toBe('gloom');
  });

  it('hydrates existing worlds without a source snapshot and captures it on the next save', () => {
    const saved = serializeWorld(createServerWorld('cave', 'old-map', 'source-seed', 'hero'));
    delete saved.dropContext;
    const restored = deserializeWorld(saved, 0);
    expect(serializeWorld(restored).dropContext).toEqual({ tokenType: 'gloom', mapTier: 1 });
  });

  it('finishes a saved mining action with its starting scope even if the current context changes', () => {
    const map = new HexMapBuilder().name('source-action').width(2).height(1).build();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create('rock', tile.coordinates);
    const state = toState(map);
    state.loot = {
      seed: 'source-secret',
      sourceId: 'cave-action',
      dropContext: { tokenType: ETokenType.GLOOM, mapTier: 2 },
    };
    const ctx = createContext();
    const started = applyCommand(
      state,
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: 'hero',
          coordinates: tile.coordinates,
          actionType: EHexActionType.MINE,
          toolKey: 'pickaxe',
          now: 0,
        },
      },
      ctx,
    );
    expect(started.events[0].type).toBe('HEX_ACTION_STARTED');
    state.map = HexMapModel.fromJSON(structuredClone(map.toJSON()), 0);
    state.loot.dropContext = { tokenType: ETokenType.IDOL, mapTier: 1 };
    const finished = applyCommand(
      state,
      { type: 'FINISH_PENDING_ACTIONS', payload: { now: 60_000 } },
      ctx,
    );
    expect(finished.events).toContainEqual({
      type: 'RESOURCE_GATHERED',
      payload: {
        action: 'MINE',
        hexobjectKey: 'rock',
        amount: 10,
        dimension: EDimension.UNDERWORLD,
      },
    });
  });

  it('closes a saved battle with the captured source rather than the later caller scope', () => {
    const at = { columnIndex: 4, rowIndex: 4 };
    const state = squadWorld({
      squads: [{ key: 'lone-skeleton', at }],
      hero: { columnIndex: 3, rowIndex: 4 },
    });
    state.loot!.dropContext = { tokenType: ETokenType.GLOOM, mapTier: 2 };
    hexAction(state, EHexActionType.ATTACK, at);
    lifecycle(state, {
      kind: 'start',
      heroes: [
        heroBattleCreature({
          id: 'hero-1',
          hearts: 3,
          weapon: null,
          shield: null,
          bag: [],
        }),
      ],
    });
    state.battle = battleStateSchema.parse(JSON.parse(JSON.stringify(state.battle)));
    state.battle.outcome = 'victory';
    state.battle.phase = 'ended';
    state.loot!.dropContext = { tokenType: ETokenType.IDOL, mapTier: 1 };
    expect(
      lifecycle(state, { kind: 'close' }).find((event) => event.type === 'BATTLE_CLOSED')?.payload,
    ).toMatchObject({ dimension: EDimension.UNDERWORLD, kills: 1 });
  });
});

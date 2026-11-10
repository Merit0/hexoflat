import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { EHexActionTypeForTests, deserializeWorld, serializeWorld } from './world-test-support';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { commandJournal, expeditionBlobs, itemLedger } from '../db/schema';
import {
  ensureExpedition,
  patchBlobs,
  loadBlobs,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { WorldService, type WorldResponse } from './world.service';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('the world the server holds (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;

  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const progressRevision = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!.revision;

  async function send(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown>,
    options: { revision?: number; commandId?: string } = {},
  ): Promise<WorldResponse> {
    return world.execute(userId, {
      commandId: options.commandId ?? randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: options.revision ?? (await progressRevision(userId, heroId)),
      command: { type, payload: { heroId, ...payload } },
    });
  }

  const enter = (userId: string, heroId: string, locationKey: string) =>
    send(userId, heroId, 'WORLD_ENTER', { locationKey });

  async function placeBesideHero(userId: string, heroId: string, key: string) {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const presence = (
      (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
        presence: { mapId: string };
      }
    ).presence;
    const raw = await readServerDocument(kit.db, expeditionId, `srv-world:${presence.mapId}`);
    const loaded = deserializeWorld(JSON.parse(raw!), 0);
    const spot = getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
      const tile = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const tile = loaded.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
    )!;
    tile.hexobject = HexObjectFactory.create(key as never, spot);
    tile.isRevealed = true;
    await kit.db.transaction((tx) =>
      writeServerDocument(
        tx,
        expeditionId,
        `srv-world:${presence.mapId}`,
        JSON.stringify(serializeWorld(loaded)),
      ),
    );
    return { spot, expeditionId, mapId: presence.mapId };
  }

  it('builds the map itself on the first entry, puts the hero at the entry, and gives the same map next time', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const first = await enter(userId, heroId, 'silesia');
    expect(first.result).toBe('applied');
    expect(first.hero).toMatchObject({ locationKey: 'silesia' });
    expect(first.hero!.coordinates).not.toBeNull();
    const again = await enter(userId, heroId, 'silesia');
    expect(again.hero!.mapId).toBe(first.hero!.mapId);
    const other = await enter(userId, heroId, 'camping');
    expect(other.hero!.mapId).not.toBe(first.hero!.mapId);
  });

  it('keeps the server maps away from the browser: it can neither read nor write them', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    expect(Object.keys(await loadBlobs(kit.db, expeditionId))).toEqual([]);
    const rows = await kit.db
      .select()
      .from(expeditionBlobs)
      .where(eq(expeditionBlobs.expeditionId, expeditionId));
    const keys = rows.map((row) => row.key);
    expect(keys).toContain('srv-index');
    expect(keys.some((key) => key.startsWith('srv-world:'))).toBe(true);
    await expect(patchBlobs(kit.db, expeditionId, { 'srv-index': '{}' }, [])).rejects.toMatchObject(
      {
        code: 'BAD_KEY',
      },
    );
    await expect(patchBlobs(kit.db, expeditionId, {}, ['srv-index'])).rejects.toMatchObject({
      code: 'BAD_KEY',
    });
  });

  it('refuses a step before the hero has entered any world', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const result = await send(userId, heroId, 'WORLD_STEP', {
      target: { columnIndex: 1, rowIndex: 1 },
    });
    expect(result).toMatchObject({ result: 'rejected', code: 'NO_WORLD' });
  });

  async function firstStepTarget(userId: string, heroId: string) {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const presence = (
      (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
        presence: { mapId: string };
      }
    ).presence;
    const loaded = deserializeWorld(
      JSON.parse((await readServerDocument(kit.db, expeditionId, `srv-world:${presence.mapId}`))!),
      0,
    );
    return getHexNeighbors(loaded.heroCoordinates!).find((hex) => {
      const tile = loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && tile.isRevealed && !tile.hexobject && tile.terrain === 'ground';
    })!;
  }

  it('walks one hex on the server map: Will, steps, fog and place change together, and survive a reload', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    const target = await firstStepTarget(userId, heroId);
    const stepped = await send(userId, heroId, 'WORLD_STEP', { target });
    expect(stepped.result).toBe('applied');
    expect(stepped.tileDiffs.length).toBeGreaterThan(0);
    expect(stepped.hero!.coordinates).toEqual(target);

    const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
      steps: number;
      presence: { coordinates: unknown };
      knowledge: { current: number };
    };
    expect(progress.steps).toBe(1);
    expect(progress.knowledge.current).toBe(49);
    expect(progress.presence.coordinates).toEqual(target);
    const snapshot = (await world.snapshot(userId, heroId)) as { heroCoordinates: unknown };
    expect(snapshot.heroCoordinates).toEqual(target);
  });

  it('refuses a hex that is not next to the hero, one the map blocks, and changes nothing', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    const before = await progressRevision(userId, heroId);
    const far = await send(userId, heroId, 'WORLD_STEP', {
      target: { columnIndex: 200, rowIndex: 200 },
    });
    expect(far).toMatchObject({ result: 'rejected', code: 'INVALID_STEP' });
    expect(await progressRevision(userId, heroId)).toBe(before);
  });

  it('applies a repeated commandId once and lets only one of ten parallel steps through', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    const target = await firstStepTarget(userId, heroId);
    const revision = await progressRevision(userId, heroId);
    const commandId = randomUUID();
    const a = await send(userId, heroId, 'WORLD_STEP', { target }, { revision, commandId });
    const b = await send(userId, heroId, 'WORLD_STEP', { target }, { revision, commandId });
    expect(a.result).toBe('applied');
    expect(b).toMatchObject({ result: 'applied', replayed: true });

    const second = await enter(userId, heroId, 'silesia');
    expect(second.result).toBe('applied');
    const racing = await Promise.all(
      Array.from({ length: 10 }, () =>
        send(userId, heroId, 'WORLD_TICK', {}, { revision: a.aggregates.progress!.revision + 1 }),
      ),
    );
    expect(racing.filter((r) => r.result === 'applied')).toHaveLength(1);
  });

  it('gives the loot of a finished action to the inventory, by the server clock, once', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.HEALTH_BOTTLE);
    const started = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.TAKE,
      toolKey: HEXOBJECT_KEYS.HAND,
    });
    expect(started.result).toBe('applied');

    const far = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: { columnIndex: 0, rowIndex: 0 },
      actionType: EHexActionTypeForTests.TAKE,
      toolKey: HEXOBJECT_KEYS.HAND,
    });
    expect(far).toMatchObject({ result: 'rejected' });

    let held = 0;
    for (let i = 0; i < 40 && held === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const ticked = await send(userId, heroId, 'WORLD_TICK', {});
      const inventory = (ticked.aggregates.inventory?.state ?? undefined) as
        InventoryState | undefined;
      held = inventory
        ? [...inventory.bag, ...Object.values(inventory.equip)].filter(
            (cell) => cell?.key === HEXOBJECT_KEYS.HEALTH_BOTTLE,
          ).length
        : 0;
    }
    expect(held).toBe(1);
    const ledger = await kit.db
      .select()
      .from(itemLedger)
      .where(
        and(eq(itemLedger.heroId, heroId), eq(itemLedger.itemKey, HEXOBJECT_KEYS.HEALTH_BOTTLE)),
      );
    expect(ledger.map((row) => row.delta)).toEqual([1]);
    const journal = await kit.db
      .select()
      .from(commandJournal)
      .where(eq(commandJournal.heroId, heroId));
    expect(
      journal.some((row) => row.commandType === 'WORLD_ACTION' && row.result === 'applied'),
    ).toBe(true);
  });

  async function setHealth(userId: string, heroId: string, current: number) {
    const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    await kit.service.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: progress.revision,
      command: { type: 'DEV_SET_HEALTH', payload: { heroId, current } },
    });
  }

  it('raises the stored maximum when a shield is put in the hand, and keeps a full hero full', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const before = (await kit.service.snapshot(userId, heroId)).aggregates;
    const inventory = structuredClone(before.inventory!.state) as {
      equip: Record<string, unknown>;
      idSeq: number;
    };
    inventory.equip.shield = {
      id: `${heroId}:0`,
      key: HEXOBJECT_KEYS.SHIELD,
      type: 'equipment',
      amount: 1,
    };
    inventory.idSeq = 1;
    const result = await kit.service.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'inventory',
      expectedRevision: before.inventory!.revision,
      command: {
        type: 'DEV_SET_INVENTORY',
        payload: { heroId, revision: before.inventory!.revision, inventory },
      },
    });
    expect(result.result).toBe('applied');
    const after = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    expect((after.state as { health: unknown }).health).toEqual({ current: 4, bonus: 1, debt: 0 });
    expect(after.revision).toBeGreaterThan(before.progress!.revision);
  });

  it('answers an action with the effects the client replays, and a refusal with none', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.FIREPLACE);
    const hint = { tool: { dragging: true, hover: spot, active: HEXOBJECT_KEYS.HAND } };
    await setHealth(userId, heroId, 1);
    const started = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.USE,
      toolKey: HEXOBJECT_KEYS.HAND,
      client: hint,
    });
    expect(started.result).toBe('applied');
    expect(started.effects).toHaveLength(1);
    expect(started.effects[0]).toMatchObject({ kind: 'lockTool', coordinates: spot });
    expect(typeof (started.effects[0] as { endsAt: number }).endsAt).toBe('number');

    const refused = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: { columnIndex: 0, rowIndex: 0 },
      actionType: EHexActionTypeForTests.USE,
      toolKey: HEXOBJECT_KEYS.HAND,
      client: hint,
    });
    expect(refused).toMatchObject({ result: 'rejected', effects: [] });

    await setHealth(userId, heroId, 3);
    const full = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.USE,
      toolKey: HEXOBJECT_KEYS.HAND,
      client: hint,
    });
    expect(full).toMatchObject({ result: 'rejected', effects: [] });
  });

  it('reports the wear of a tool that breaks on this use even though the action is refused', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.TREE);
    const refused = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.CUT,
      toolKey: HEXOBJECT_KEYS.AXE,
      client: {
        tool: {
          dragging: true,
          hover: spot,
          active: HEXOBJECT_KEYS.AXE,
          durability: { current: 1, max: 100 },
        },
      },
    });
    expect(refused).toMatchObject({ result: 'rejected', code: 'ACTION_REJECTED' });
    expect(refused.effects.map((effect) => effect.kind)).toEqual([
      'consumeDurability',
      'setActiveTool',
    ]);
  });

  it('refuses a client hint that carries anything else', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    await expect(
      send(userId, heroId, 'WORLD_TICK', {
        client: {
          tool: { dragging: false, hover: null, active: null, extra: 1 },
        },
      }),
    ).rejects.toBeDefined();
  });

  async function presenceOf(userId: string, heroId: string) {
    return (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
      presence: { locationKey: string; mapId: string };
      sealedUntil: Record<string, number>;
      knowledge: { current: number };
    };
  }

  it('walks through a gate on the server: the Will is charged, the presence moves and the map comes back', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.CAVE_ENTRANCE);
    const travelled = await send(userId, heroId, 'WORLD_TRAVEL', {
      via: { kind: 'gate', coordinates: spot },
    });
    expect(travelled.result).toBe('applied');
    expect(travelled.travel?.locationKey).toBe('cave');
    const after = await presenceOf(userId, heroId);
    expect(after.presence).toMatchObject({ locationKey: 'cave' });
    expect(after.knowledge.current).toBe(48);
    expect(travelled.hero).toMatchObject({ locationKey: 'cave' });
  });

  it('refuses to travel by a hex that is no gate, and from nowhere', async () => {
    const lost = await kit.newPlayer();
    expect(
      await send(lost.userId, lost.heroId, 'WORLD_TRAVEL', { via: { kind: 'exit' } }),
    ).toMatchObject({ result: 'rejected', code: 'NO_WORLD' });
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'silesia');
    expect(
      await send(userId, heroId, 'WORLD_TRAVEL', {
        via: { kind: 'gate', coordinates: { columnIndex: 0, rowIndex: 0 } },
      }),
    ).toMatchObject({ result: 'rejected', code: 'NOT_A_GATE' });
    expect((await presenceOf(userId, heroId)).presence.locationKey).toBe('silesia');
  });

  it('leaves a dungeon through its gate: a fresh dungeon waits on the server and a cleared one is sealed', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const first = await enter(userId, heroId, 'cave');
    const oldMapId = first.hero!.mapId;
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.CAMPING_ENTRANCE);
    await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.GRAVE);
    const travelled = await send(userId, heroId, 'WORLD_TRAVEL', {
      via: { kind: 'gate', coordinates: spot },
    });
    expect(travelled.result).toBe('applied');
    expect(travelled.travel?.refreshed?.locationKey).toBe('cave');
    const again = (await world.ensure(userId, heroId, 'cave')) as { mapId: string };
    expect(again.mapId).not.toBe(oldMapId);
    const state = await presenceOf(userId, heroId);
    expect(state.presence.locationKey).toBe('camping');
    expect(state.sealedUntil.cave).toBeGreaterThan(Date.now());
    const back = await send(userId, heroId, 'WORLD_TRAVEL', {
      via: { kind: 'gate', coordinates: { columnIndex: 0, rowIndex: 0 } },
    });
    expect(back.result).toBe('rejected');
  });

  async function equipForPortal(userId: string, heroId: string) {
    const snapshot = await kit.service.snapshot(userId, heroId);
    const inventoryRevision = snapshot.aggregates.inventory!.revision;
    await kit.service.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'inventory',
      expectedRevision: inventoryRevision,
      command: {
        type: 'DEV_GRANT_ITEM',
        payload: {
          heroId,
          revision: inventoryRevision,
          key: HEXOBJECT_KEYS.RETURN_SCROLL,
          amount: 2,
        },
      },
    });
    const progress = snapshot.aggregates.progress!;
    const knowledge = (progress.state as { knowledge: { revision: number } }).knowledge;
    await kit.service.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: progress.revision,
      command: {
        type: 'DEV_SET_KNOWLEDGE',
        payload: {
          heroId,
          revision: knowledge.revision,
          knowledge: { ...knowledge, skills: { a_crest: 1, a_teleport: 6 } },
        },
      },
    });
  }

  it('opens a portal, walks it to the camp and back, and keeps both ends on the server', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    await enter(userId, heroId, 'silesia');
    await equipForPortal(userId, heroId);
    const origin = (await presenceOf(userId, heroId)).presence;
    const held = deserializeWorld(await world.snapshot(userId, heroId), 0);
    const target = getHexNeighbors(held.heroCoordinates!).find((hex) => {
      const tile = held.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && tile.terrain === 'ground' && !tile.hexobject && !tile.exit;
    })!;

    const far = await send(userId, heroId, 'WORLD_PORTAL_OPEN', {
      target: { columnIndex: 250, rowIndex: 250 },
    });
    expect(far.result).toBe('rejected');

    const opened = await send(userId, heroId, 'WORLD_PORTAL_OPEN', { target });
    expect(opened).toMatchObject({ result: 'applied' });
    expect(opened.tileDiffs.length).toBeGreaterThan(0);
    const inventoryAfter = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    expect(JSON.stringify(inventoryAfter.state)).toContain(HEXOBJECT_KEYS.RETURN_SCROLL);

    const there = await send(userId, heroId, 'WORLD_PORTAL_ENTER', {});
    expect(there.result).toBe('applied');
    expect(there.travel?.locationKey).toBe('camping');
    expect((await presenceOf(userId, heroId)).presence.locationKey).toBe('camping');

    const back = await send(userId, heroId, 'WORLD_PORTAL_ENTER', {});
    expect(back.result).toBe('applied');
    expect((await presenceOf(userId, heroId)).presence.mapId).toBe(origin.mapId);
    const closedAgain = await send(userId, heroId, 'WORLD_PORTAL_CLOSE', {});
    expect(closedAgain).toMatchObject({ result: 'rejected', code: 'NO_PORTAL' });
  });

  it('builds a location on request without moving the hero, and keeps it', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const a = (await world.ensure(userId, heroId, 'silesia')) as { mapId: string };
    const b = (await world.ensure(userId, heroId, 'silesia')) as { mapId: string };
    expect(b.mapId).toBe(a.mapId);
    const presence = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
      presence: unknown;
    };
    expect(presence.presence).toBeNull();
    await expect(world.ensure(randomUUID(), heroId, 'silesia')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('refuses unknown fields and other accounts', async () => {
    const mine = await kit.newPlayer();
    const other = await kit.newPlayer();
    await expect(
      send(mine.userId, mine.heroId, 'WORLD_ENTER', { locationKey: 'silesia', extra: 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    await expect(
      send(other.userId, mine.heroId, 'WORLD_ENTER', { locationKey: 'silesia' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      send(mine.userId, mine.heroId, 'WORLD_ENTER', { locationKey: 'mars' }),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  });

  async function openBattle() {
    const { userId, heroId } = await kit.newPlayer();
    await kit.service.grantItem(userId, heroId, HEXOBJECT_KEYS.SWORD, 1, 'dev');
    await enter(userId, heroId, 'cave');
    const { spot, expeditionId, mapId } = await placeBesideHero(
      userId,
      heroId,
      HEXOBJECT_KEYS.SKELETON_PACK,
    );
    const attack = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.ATTACK,
      toolKey: HEXOBJECT_KEYS.HAND,
    });
    expect(attack.result).toBe('applied');
    const start = await send(userId, heroId, 'WORLD_BATTLE', { kind: 'start' });
    return { userId, heroId, expeditionId, mapId, attack, start };
  }

  const storedWorld = async (expeditionId: string, mapId: string) =>
    deserializeWorld(
      JSON.parse((await readServerDocument(kit.db, expeditionId, `srv-world:${mapId}`))!),
      0,
    );

  it('starts a battle on the server and never sends its secrets to the client', async () => {
    const { start, expeditionId, mapId } = await openBattle();
    expect(start.result).toBe('applied');
    expect(start.steps).toHaveLength(1);
    expect(start.steps![0].battle).toMatchObject({ viewer: 'heroes' });
    const text = JSON.stringify(start);
    for (const secret of ['"seed"', '"taskHistory"', '"wounds"', '"turnClockMs"']) {
      expect(text).not.toContain(secret);
    }
    const held = await storedWorld(expeditionId, mapId);
    expect(held.battle).not.toBeNull();
    expect(held.battle!.seed.length).toBeGreaterThan(0);
  });

  it('resumes a battle after a reload and shows only the projection', async () => {
    const { userId, heroId, start, expeditionId, mapId } = await openBattle();
    const held = await storedWorld(expeditionId, mapId);
    const snap = (await world.snapshot(userId, heroId)) as {
      battle: unknown;
      battleView: { activeId: string; viewer: string } | null;
      serverNowMs: number;
    };
    expect(snap.battle).toBeNull();
    expect(snap.battleView?.viewer).toBe('heroes');
    expect(snap.battleView?.activeId).toBe(start.steps![0].battle!.activeId);
    expect(snap.serverNowMs).toBeGreaterThan(0);
    expect(JSON.stringify(snap)).not.toContain(held.battle!.seed);
  });

  it('answers a repeated command from the journal and refuses a hero action in an enemy turn', async () => {
    const { userId, heroId } = await openBattle();
    let view = ((await world.snapshot(userId, heroId)) as { battleView: { activeId: string } })
      .battleView;
    for (let i = 0; i < 30 && !view.activeId.startsWith('skeleton'); i += 1) {
      await send(userId, heroId, 'WORLD_BATTLE', {
        kind: 'hero',
        action: { kind: 'end-turn' },
      });
      view = ((await world.snapshot(userId, heroId)) as { battleView: { activeId: string } })
        .battleView;
    }
    const refused = await send(userId, heroId, 'WORLD_BATTLE', {
      kind: 'hero',
      action: { kind: 'end-turn' },
    });
    expect(refused).toMatchObject({ result: 'rejected', code: 'NOT_YOUR_TURN' });

    const commandId = randomUUID();
    const revision = await progressRevision(userId, heroId);
    const first = await send(
      userId,
      heroId,
      'WORLD_BATTLE',
      { kind: 'run-enemy-turn' },
      { commandId, revision },
    );
    expect(first.result).toBe('applied');
    const again = await send(
      userId,
      heroId,
      'WORLD_BATTLE',
      { kind: 'run-enemy-turn' },
      { commandId, revision },
    );
    expect(again.replayed).toBe(true);
    const later = (await world.snapshot(userId, heroId)) as {
      battleView: { activeId: string; round: number };
    };
    const once = first.steps!.at(-1)!.battle!;
    expect(later.battleView.round).toBeGreaterThanOrEqual(once.round);
  });

  it('plays an overdue enemy turn exactly once when the player comes back', async () => {
    const { userId, heroId, expeditionId, mapId } = await openBattle();
    for (let i = 0; i < 30; i += 1) {
      const view = ((await world.snapshot(userId, heroId)) as { battleView: { activeId: string } })
        .battleView;
      if (view.activeId.startsWith('skeleton')) break;
      await send(userId, heroId, 'WORLD_BATTLE', { kind: 'hero', action: { kind: 'end-turn' } });
    }
    const held = await storedWorld(expeditionId, mapId);
    expect(held.battle!.activeId.startsWith('skeleton')).toBe(true);
    held.battle!.turnClockMs = 1;
    await kit.db.transaction((tx) =>
      writeServerDocument(
        tx,
        expeditionId,
        `srv-world:${mapId}`,
        JSON.stringify(serializeWorld(held)),
      ),
    );
    const before = await progressRevision(userId, heroId);
    const first = (await world.snapshot(userId, heroId)) as { serverNowMs: number };
    const played = await progressRevision(userId, heroId);
    expect(played).toBe(before + 1);
    const after = await storedWorld(expeditionId, mapId);
    expect(after.battle!.turnClockMs).toBeGreaterThanOrEqual(first.serverNowMs - 5_000);
    await world.snapshot(userId, heroId);
    expect(await progressRevision(userId, heroId)).toBe(played);
  });

  it('keeps the inventory and the health away from the browser while a battle is open', async () => {
    const { userId, heroId } = await openBattle();
    const snapshot = await kit.service.snapshot(userId, heroId);
    const inventoryRevision = snapshot.aggregates.inventory!.revision;
    const sorted = await kit.service.execute(
      userId,
      envelope(heroId, 'SORT_STASH', {}, inventoryRevision),
    );
    expect(sorted).toMatchObject({ result: 'rejected', code: 'BATTLE_OPEN' });
    const health = await kit.service.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: snapshot.aggregates.progress!.revision,
      command: { type: 'DEV_SET_HEALTH', payload: { heroId, current: 3 } },
    });
    expect(health).toMatchObject({ result: 'rejected', code: 'BATTLE_OPEN' });
  });

  it('refuses the world commands while a battle is open', async () => {
    const { userId, heroId } = await openBattle();
    const step = await send(userId, heroId, 'WORLD_STEP', {
      target: { columnIndex: 0, rowIndex: 0 },
    });
    expect(step).toMatchObject({ result: 'rejected', code: 'BATTLE_OPEN' });
  });

  it('respawns the hero in the camp when a lost battle is closed, with a fresh dungeon', async () => {
    const { userId, heroId, expeditionId, mapId } = await openBattle();
    const held = await storedWorld(expeditionId, mapId);
    const battle = held.battle!;
    battle.creatures.find((c) => c.side === 'heroes')!.hp = 0;
    battle.outcome = 'defeat';
    battle.phase = 'ended';
    await kit.db.transaction((tx) =>
      writeServerDocument(
        tx,
        expeditionId,
        `srv-world:${mapId}`,
        JSON.stringify(serializeWorld(held)),
      ),
    );
    const closed = await send(userId, heroId, 'WORLD_BATTLE', { kind: 'close' });
    expect(closed.result).toBe('applied');
    expect(closed.travel?.locationKey).toBe('camping');
    expect(closed.travel?.refreshed?.locationKey).toBe('cave');
    expect(closed.events.map((event) => event.type)).toContain('HERO_RESPAWNED');
    const progress = closed.aggregates.progress!.state as {
      presence: { locationKey: string };
      health: { current: number };
    };
    expect(progress.presence.locationKey).toBe('camping');
    expect(progress.health.current).toBe(1);
    expect(await readServerDocument(kit.db, expeditionId, `srv-world:${mapId}`)).toBeNull();
    expect(JSON.stringify(closed)).not.toContain(battle.seed);
  });

  it('sends the hero home when he comes back to a lost battle he never left', async () => {
    const { userId, heroId, expeditionId, mapId } = await openBattle();
    const held = await storedWorld(expeditionId, mapId);
    held.battle!.creatures.find((c) => c.side === 'heroes')!.hp = 0;
    held.battle!.outcome = 'defeat';
    held.battle!.phase = 'ended';
    await kit.db.transaction((tx) =>
      writeServerDocument(
        tx,
        expeditionId,
        `srv-world:${mapId}`,
        JSON.stringify(serializeWorld(held)),
      ),
    );
    await world.settleDefeat(userId, heroId);
    const snapshot = (await world.snapshot(userId, heroId)) as {
      locationKey: string;
      battleView: unknown;
    };
    expect(snapshot.locationKey).toBe('camping');
    expect(snapshot.battleView).toBeNull();
    expect(await readServerDocument(kit.db, expeditionId, `srv-world:${mapId}`)).toBeNull();
    await world.settleDefeat(userId, heroId);
  });

  it('leaves a battle that is still going alone when the player comes back', async () => {
    const { userId, heroId } = await openBattle();
    await world.settleDefeat(userId, heroId);
    const snapshot = (await world.snapshot(userId, heroId)) as {
      locationKey: string;
      battleView: unknown;
    };
    expect(snapshot.locationKey).toBe('cave');
    expect(snapshot.battleView).not.toBeNull();
  });

  it('moves a battle with a fixture only when the e2e flag is on (REQ-B5-FIX-001)', async () => {
    const { userId, heroId, expeditionId, mapId } = await openBattle();
    delete process.env.HEXOFLAT_E2E_FIXTURES;
    await expect(
      world.battleFixture(userId, heroId, { kind: 'hero-turn', will: 9 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    process.env.HEXOFLAT_E2E_FIXTURES = '1';
    try {
      await expect(
        world.battleFixture(userId, heroId, { kind: 'hero-turn', will: 99 }),
      ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      const view = (await world.battleFixture(userId, heroId, { kind: 'hero-turn', will: 9 })) as {
        battleView: { activeId: string; turnWill: number; viewer: string };
      };
      expect(view.battleView).toMatchObject({ viewer: 'heroes', turnWill: 9 });
      const held = await storedWorld(expeditionId, mapId);
      expect(held.battle!.activeId).toBe(view.battleView.activeId);
      expect(JSON.stringify(view)).not.toContain(held.battle!.seed);
    } finally {
      delete process.env.HEXOFLAT_E2E_FIXTURES;
    }
  });

  it('places an object beside the hero with a world fixture only when the e2e flag is on', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    delete process.env.HEXOFLAT_E2E_FIXTURES;
    await expect(
      world.worldFixture(userId, heroId, {
        kind: 'place-hexobject',
        key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    process.env.HEXOFLAT_E2E_FIXTURES = '1';
    try {
      await expect(
        world.worldFixture(userId, heroId, { kind: 'place-hexobject', key: 'nope' }),
      ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
      const placed = (await world.worldFixture(userId, heroId, {
        kind: 'place-hexobject',
        key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      })) as { coordinates: { columnIndex: number }; tileDiffs: unknown[] };
      expect(placed.tileDiffs).toHaveLength(1);
    } finally {
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
    }
  });

  it('hides the members and the loot of an unscouted squad in every map the client gets', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'cave');
    await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.SKELETON_PACK);
    const ensured = JSON.stringify(await world.ensure(userId, heroId, 'cave'));
    expect(ensured).not.toContain('"loot":"sword"');
    expect(ensured).toContain('skeleton-pack');
    const snap = JSON.stringify(await world.snapshot(userId, heroId));
    expect(snap).not.toContain('"loot":"sword"');
  });

  it('does not deadlock when world commands and inventory commands race on one hero', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, async (_, i) => {
        if (i % 2 === 0) {
          return send(userId, heroId, 'WORLD_TICK', {}, { revision: undefined });
        }
        const revision = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!
          .revision;
        return kit.service.execute(userId, envelope(heroId, 'SORT_STASH', {}, revision));
      }),
    );
    const failures = results.flatMap((entry) =>
      entry.status === 'rejected' ? [String((entry.reason as Error).message ?? entry.reason)] : [],
    );
    expect(failures.filter((message) => /deadlock/i.test(message))).toEqual([]);
  });
});

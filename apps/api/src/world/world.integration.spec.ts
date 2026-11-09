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
import { createTestKit, type TestKit } from '../player/player-test-kit';
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
    expect(progress.knowledge.current).toBe(19);
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

  it('answers an action with the effects the client replays, and a refusal with none', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const { spot } = await placeBesideHero(userId, heroId, HEXOBJECT_KEYS.FIREPLACE);
    const hint = {
      tool: { dragging: true, hover: spot, active: HEXOBJECT_KEYS.HAND },
      health: { current: 1, max: 3 },
    };
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

    const full = await send(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.USE,
      toolKey: HEXOBJECT_KEYS.HAND,
      client: { ...hint, health: { current: 3, max: 3 } },
    });
    expect(full).toMatchObject({ result: 'rejected', effects: [] });
  });

  it('refuses a client hint that carries anything else', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    await expect(
      send(userId, heroId, 'WORLD_TICK', {
        client: {
          tool: { dragging: false, hover: null, active: null, extra: 1 },
          health: { current: 1, max: 3 },
        },
      }),
    ).rejects.toBeDefined();
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

  it('keeps the hero where he is when a world that is not his current one is adopted', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await enter(userId, heroId, 'camping');
    const before = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
      presence: { mapId: string };
    };
    const other = (await world.ensure(userId, heroId, 'silesia')) as Record<string, unknown>;
    const adopted = await world.adopt(userId, heroId, { ...other, current: false });
    expect(adopted.progress).toBeDefined();
    const after = (await kit.service.snapshot(userId, heroId)).aggregates.progress!.state as {
      presence: { mapId: string };
    };
    expect(after.presence.mapId).toBe(before.presence.mapId);
  });

  it('adopts a world the client changed, only outside production, and replaces the old map of the location', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const built = (await world.ensure(userId, heroId, 'camping')) as Record<string, unknown>;
    const changed = { ...built, mapId: randomUUID(), current: true };
    const adopted = await world.adopt(userId, heroId, changed);
    expect(adopted.progress?.revision).toBe(await progressRevision(userId, heroId));
    expect((adopted.progress?.state as { presence: { mapId: string } }).presence.mapId).toBe(
      changed.mapId,
    );
    const again = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
    expect(again.mapId).toBe(changed.mapId);
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    expect(
      await readServerDocument(kit.db, expeditionId, `srv-world:${built.mapId as string}`),
    ).toBeNull();

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(world.adopt(userId, heroId, changed)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    } finally {
      process.env.NODE_ENV = previous;
    }
    await expect(world.adopt(userId, heroId, { nonsense: true })).rejects.toMatchObject({
      code: 'INVALID_COMMAND',
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
});

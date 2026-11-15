import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  QUEST_RUN_COMMAND_SCHEMAS,
  canEnterQuestWorld,
  deserializeWorld,
  executeQuestRunCommand,
  isQuestRunCommandType,
  parseQuestRunDoc,
  projectQuestForClient,
  type DomainEvent,
  type QuestProjection,
  type QuestRunDoc,
} from '@hexoflat/engine';
import { DB, type Db } from '../db/db.module';
import { commandJournal, itemLedger } from '../db/schema';
import {
  deleteServerDocument,
  ensureExpedition,
  expeditionSeed,
  lockExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { HeroesService } from '../heroes/heroes.service';
import {
  createInitialAggregates,
  loadAggregatesForUpdate,
  projectAggregate,
  saveAggregate,
  type Tx,
} from '../player/aggregate-store';
import { ledgerEntriesFor } from '../player/item-ledger';
import {
  MAX_COMMAND_BYTES,
  PlayerCommandEnvelopeSchema,
  PlayerCommandError,
  type ProjectedAggregates,
} from '../player/player-command.types';

export const QUEST_RUN_KEY = 'srv-quest';

export interface QuestRunResponse {
  commandId: string;
  result: 'applied' | 'rejected' | 'conflict';
  code?: string;
  replayed?: boolean;
  events: DomainEvent[];
  quest: QuestProjection | null;
  aggregates: ProjectedAggregates;
}

async function readDoc(tx: Tx | Db, expeditionId: string): Promise<QuestRunDoc | null> {
  const raw = await readServerDocument(tx, expeditionId, QUEST_RUN_KEY);
  return raw ? parseQuestRunDoc(raw) : null;
}

async function battleOpen(
  tx: Tx,
  expeditionId: string,
  mapId: string | undefined,
): Promise<boolean> {
  if (!mapId) return false;
  const raw = await readServerDocument(tx, expeditionId, `srv-world:${mapId}`);
  return !!raw && !!(JSON.parse(raw) as { battle?: unknown }).battle;
}

@Injectable()
export class QuestRunService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroes: HeroesService,
  ) {}

  async snapshot(userId: string, heroId: string): Promise<{ quest: QuestProjection | null }> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    const doc = await readDoc(this.db, expeditionId);
    return { quest: doc && !doc.suspended ? projectQuestForClient(doc.run) : null };
  }

  async execute(userId: string, raw: unknown): Promise<QuestRunResponse> {
    if (JSON.stringify(raw ?? null).length > MAX_COMMAND_BYTES) {
      throw new PlayerCommandError('PAYLOAD_TOO_LARGE');
    }
    const envelope = PlayerCommandEnvelopeSchema.safeParse(raw);
    if (!envelope.success) throw new PlayerCommandError('INVALID_ENVELOPE');
    const { commandId, heroId, aggregate, expectedRevision, command: sent } = envelope.data;
    if (!isQuestRunCommandType(sent.type)) throw new PlayerCommandError('UNKNOWN_COMMAND');
    if (aggregate !== 'progress') throw new PlayerCommandError('AGGREGATE_MISMATCH');
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const parsed = QUEST_RUN_COMMAND_SCHEMAS[sent.type].safeParse(sent);
    if (!parsed.success) throw new PlayerCommandError('INVALID_COMMAND');
    const command = parsed.data;
    if (command.payload.heroId !== heroId) throw new PlayerCommandError('FORBIDDEN');

    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      await createInitialAggregates(tx, heroId);
      const loaded = await loadAggregatesForUpdate(tx, heroId, ['progress', 'inventory']);
      const progress = loaded.progress;
      const inventory = loaded.inventory;
      if (!progress || !inventory) throw new Error(`Hero ${heroId} has no aggregates`);
      const doc = await readDoc(tx, expeditionId);

      const [prior] = await tx
        .select()
        .from(commandJournal)
        .where(eq(commandJournal.commandId, commandId))
        .limit(1);
      const respond = (
        result: QuestRunResponse['result'],
        events: DomainEvent[],
        code: string | undefined,
        quest: QuestRunDoc | null,
        state = progress,
        extra: Partial<QuestRunResponse> = {},
        bag: typeof inventory = inventory,
      ): QuestRunResponse => ({
        commandId,
        result,
        ...(code ? { code } : {}),
        events,
        quest: quest && !quest.suspended ? projectQuestForClient(quest.run) : null,
        aggregates: { progress: projectAggregate(state), inventory: projectAggregate(bag) },
        ...extra,
      });
      if (prior) {
        if (prior.heroId !== heroId || prior.userId !== userId) {
          throw new PlayerCommandError('FORBIDDEN');
        }
        return respond(
          prior.result,
          prior.events as DomainEvent[],
          prior.reason ?? undefined,
          doc,
          progress,
          {
            replayed: true,
          },
        );
      }

      const journal = (
        result: 'applied' | 'rejected' | 'conflict',
        events: DomainEvent[],
        reason: string | null,
        newRevision: number | null,
      ) =>
        tx.insert(commandJournal).values({
          commandId,
          userId,
          heroId,
          aggregateKind: 'progress',
          commandType: command.type,
          payload: command.payload,
          expectedRevision,
          result,
          reason,
          events,
          newRevision,
        });

      if (progress.revision !== expectedRevision) {
        await journal('conflict', [], 'REVISION_CONFLICT', null);
        return respond('conflict', [], 'REVISION_CONFLICT', doc);
      }
      if (
        command.type === 'QUEST_ENTER' &&
        (await battleOpen(tx, expeditionId, progress.state.presence?.mapId))
      ) {
        await journal('rejected', [], 'BATTLE_OPEN', null);
        return respond('rejected', [], 'BATTLE_OPEN', doc);
      }

      let atEntrance = false;
      if (command.type === 'QUEST_ENTER' && progress.state.presence) {
        const rawWorld = await readServerDocument(
          tx,
          expeditionId,
          `srv-world:${progress.state.presence.mapId}`,
        );
        atEntrance =
          !!rawWorld &&
          canEnterQuestWorld(
            deserializeWorld(JSON.parse(rawWorld), Date.now()),
            command.payload.questId,
          );
      }
      const seed = await expeditionSeed(tx, expeditionId);
      const outcome = executeQuestRunCommand({
        progress: progress.state,
        doc,
        command,
        atEntrance,
        inventory: inventory.state,
        newSeed: () => `${seed}:quest:${randomUUID()}`,
      });
      if (!outcome.ok) {
        await journal('rejected', outcome.events, outcome.code, null);
        return respond('rejected', outcome.events, outcome.code, doc);
      }

      const revision = await saveAggregate(
        tx,
        heroId,
        'progress',
        progress.revision,
        outcome.progress,
      );
      let bag = inventory;
      if (outcome.inventory && outcome.inventory !== inventory.state) {
        const bagRevision = await saveAggregate(
          tx,
          heroId,
          'inventory',
          inventory.revision,
          outcome.inventory,
        );
        bag = { ...inventory, revision: bagRevision, state: outcome.inventory };
        const entries = ledgerEntriesFor(outcome.events, inventory.state);
        if (entries.length > 0) {
          await tx
            .insert(itemLedger)
            .values(entries.map((entry) => ({ heroId, commandId, ...entry })));
        }
      }
      if (command.type === 'QUEST_ENTER' && outcome.doc && !doc) {
        const rawIndex = await readServerDocument(tx, expeditionId, 'srv-index');
        const campId = rawIndex
          ? (JSON.parse(rawIndex) as { camping?: string }).camping
          : undefined;
        const rawCamp = campId
          ? await readServerDocument(tx, expeditionId, `srv-world:${campId}`)
          : null;
        if (rawCamp && campId) {
          const campWorld = deserializeWorld(JSON.parse(rawCamp), Date.now());
          if (campWorld.heroCoordinates)
            outcome.doc.camp = {
              locationKey: 'camping',
              mapId: campId,
              coordinates: campWorld.heroCoordinates,
            };
        }
      }
      if (outcome.doc) {
        await writeServerDocument(tx, expeditionId, QUEST_RUN_KEY, JSON.stringify(outcome.doc));
      } else {
        await deleteServerDocument(tx, expeditionId, QUEST_RUN_KEY);
      }
      await journal('applied', outcome.events, null, revision);
      return respond(
        'applied',
        outcome.events,
        undefined,
        outcome.doc,
        { ...progress, revision, state: outcome.progress },
        {},
        bag,
      );
    });
  }
}

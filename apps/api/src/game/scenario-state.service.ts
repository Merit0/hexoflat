import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  deserializeState,
  serializeState,
  type ApplyCommandResult,
  type HexEngineActionContext,
  type HexEngineCommand,
  type HexEngineState,
  type SnapshotPayload,
} from '@hexoflat/engine';
import { HexMapProvider } from '@hexoflat/engine/map/providers/hex-map-provider';
import { DB, type Db } from '../db/db.module';
import { campaigns, scenarios, snapshots } from '../db/schema';
import { HeroesService } from '../heroes/heroes.service';
import { GameEngineService } from './game-engine.service';

@Injectable()
export class ScenarioStateService {
  private static readonly AUTOSAVE_INTERVAL_MS = 30_000;

  private readonly logger = new Logger(ScenarioStateService.name);
  private readonly rooms = new Map<string, HexEngineState>();
  private readonly autosaveTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroesService: HeroesService,
    @Inject(GameEngineService) private readonly gameEngineService: GameEngineService,
  ) {}

  /**
   * Resolves who owns the campaign a scenario belongs to. `null` covers both
   * "scenario doesn't exist" and "no owning campaign" — callers must treat
   * both as not-authorized (deny by default).
   */
  async getScenarioOwnerId(scenarioId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ ownerId: campaigns.ownerId })
      .from(scenarios)
      .innerJoin(campaigns, eq(scenarios.campaignId, campaigns.id))
      .where(eq(scenarios.id, scenarioId))
      .limit(1);

    return row?.ownerId ?? null;
  }

  /**
   * Loads the latest snapshot for a scenario, or bootstraps a fresh room if
   * there isn't one. A snapshot that fails its version or checksum check is
   * never partially deserialized — this rejects outright (no automatic
   * migration) so a caller (the WS gateway) can turn it into a clear
   * "can't join" error instead of a corrupted room.
   */
  async getOrCreate(scenarioId: string): Promise<HexEngineState> {
    const existing = this.rooms.get(scenarioId);
    if (existing) {
      return existing;
    }

    const [row] = await this.db
      .select({ state: snapshots.state, checksum: snapshots.checksum })
      .from(snapshots)
      .where(eq(snapshots.scenariosId, scenarioId))
      .orderBy(desc(snapshots.createdAt))
      .limit(1);

    let state: HexEngineState;

    if (row) {
      const payload = row.state as SnapshotPayload;

      if (row.checksum !== payload.checksum) {
        this.logger.error(
          `Snapshot column/payload checksum mismatch for scenario ${scenarioId} — refusing to load it.`,
        );
        throw new Error(`Corrupted snapshot for scenario ${scenarioId}.`);
      }

      try {
        state = deserializeState(payload, Date.now());
      } catch (error) {
        this.logger.error(
          `Failed to deserialize snapshot for scenario ${scenarioId}: ${(error as Error).message}`,
        );
        throw error;
      }
    } else {
      state = {
        map: HexMapProvider.getHomeLand(),
        heroes: {},
        rngState: { seed: crypto.randomUUID(), counter: 0 },
      };
    }

    this.rooms.set(scenarioId, state);
    this.scheduleAutosave(scenarioId);
    return state;
  }

  /**
   * Periodically snapshots the room while it's active, so a crash between
   * `release()` calls loses at most one interval's worth of progress instead
   * of the whole session. Only the scenario snapshot is written here — the
   * canonical `heroes.data.heroLocation` is updated once, on `release()`.
   */
  private scheduleAutosave(scenarioId: string): void {
    if (this.autosaveTimers.has(scenarioId)) {
      return;
    }

    const timer = setInterval(() => {
      void this.autosave(scenarioId);
    }, ScenarioStateService.AUTOSAVE_INTERVAL_MS);
    timer.unref?.();
    this.autosaveTimers.set(scenarioId, timer);
  }

  private async autosave(scenarioId: string): Promise<void> {
    const state = this.rooms.get(scenarioId);
    if (!state) {
      return;
    }

    const payload = serializeState(state);
    await this.db.insert(snapshots).values({
      scenariosId: scenarioId,
      saveId: null,
      state: payload,
      checksum: payload.checksum,
    });
  }

  async ensureHero(scenarioId: string, userId: string, heroId: string): Promise<void> {
    const state = await this.getOrCreate(scenarioId);
    if (state.heroes[heroId]) {
      return;
    }

    const hero = await this.heroesService.findByUserId(userId);
    if (!hero) {
      return;
    }

    state.heroes[heroId] = {
      id: heroId,
      controlledBy: userId,
      coordinates: hero.heroLocation,
      heroSteps: hero.heroSteps,
    };
  }

  dispatch(
    scenarioId: string,
    command: HexEngineCommand,
    ctx: HexEngineActionContext,
  ): ApplyCommandResult<HexEngineState> {
    const state = this.rooms.get(scenarioId);
    if (!state) {
      throw new Error(`Scenario room not initialized: ${scenarioId}`);
    }

    return this.gameEngineService.dispatch(state, command, ctx);
  }

  async release(scenarioId: string): Promise<void> {
    const timer = this.autosaveTimers.get(scenarioId);
    if (timer) {
      clearInterval(timer);
      this.autosaveTimers.delete(scenarioId);
    }

    const state = this.rooms.get(scenarioId);
    if (!state) {
      return;
    }

    const payload = serializeState(state);

    // Snapshot + the heroes-table write-back happen in one transaction: a
    // hero's canonical position (`heroes.data.heroLocation`) only ever moves
    // on release, and it must not drift from the snapshot that represents
    // "where the scenario left off".
    await this.db.transaction(async (tx) => {
      await tx.insert(snapshots).values({
        scenariosId: scenarioId,
        saveId: null,
        state: payload,
        checksum: payload.checksum,
      });

      for (const hero of Object.values(state.heroes)) {
        await this.heroesService.updateLocation(hero.id, hero.coordinates, hero.heroSteps, tx);
      }
    });

    this.rooms.delete(scenarioId);
  }
}

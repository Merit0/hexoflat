import { Inject, Injectable } from '@nestjs/common';
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
import { snapshots } from '../db/schema';
import { HeroesService } from '../heroes/heroes.service';
import { GameEngineService } from './game-engine.service';

@Injectable()
export class ScenarioStateService {
  private readonly rooms = new Map<string, HexEngineState>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroesService: HeroesService,
    @Inject(GameEngineService) private readonly gameEngineService: GameEngineService,
  ) {}

  async getOrCreate(scenarioId: string): Promise<HexEngineState> {
    const existing = this.rooms.get(scenarioId);
    if (existing) {
      return existing;
    }

    const [row] = await this.db
      .select({ state: snapshots.state })
      .from(snapshots)
      .where(eq(snapshots.scenariosId, scenarioId))
      .orderBy(desc(snapshots.createdAt))
      .limit(1);

    const state = row
      ? deserializeState(row.state as SnapshotPayload)
      : { map: HexMapProvider.getHomeLand(), heroes: {} };

    this.rooms.set(scenarioId, state);
    return state;
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
    const state = this.rooms.get(scenarioId);
    if (!state) {
      return;
    }

    await this.db.insert(snapshots).values({
      scenariosId: scenarioId,
      saveId: null,
      state: serializeState(state),
    });
    this.rooms.delete(scenarioId);
  }
}

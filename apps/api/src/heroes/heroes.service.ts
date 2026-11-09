import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { DB, type Db } from '../db/db.module';
import { heroes, users } from '../db/schema';
import { createInitialAggregates } from '../player/aggregate-store';
import { HeroDataSchema, type HeroData } from './heroes.dto';

// A fresh hero's base stats. HP starts small (3 hearts, not the 100 a hero can
// eventually grow into) — see the "0/100" bug this was chasing: nothing ever
// created a heroes row for a new user, so the frontend fell back to
// HeroModel's blank-slate defaults (0 current / 100 max) instead of a real,
// intentional starting value.
function starterHeroData(): HeroData {
  return {
    currentHealth: 3,
    maxHealth: 3,
    attack: 1,
    defense: 1,
    kills: 0,
    currentEnergy: 100,
    maxEnergy: 100,
    imgPath: '',
    heroLocation: { columnIndex: 0, rowIndex: 0 },
    heroSteps: 0,
  };
}

@Injectable()
export class HeroesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * The current hero of an account is its oldest hero that is not deleted. There is no hero picker
   * yet, so every caller that has only a user id goes through this one rule.
   */
  findByUserId = async (userId: string): Promise<IHero | null> => {
    const [record] = await this.db
      .select()
      .from(heroes)
      .where(and(eq(heroes.userId, userId), isNull(heroes.deletedAt)))
      .orderBy(asc(heroes.createdAt), asc(heroes.id))
      .limit(1);
    if (!record) {
      return null;
    }
    const data = HeroDataSchema.parse(record.data);
    return { id: record.id, name: record.name, ...data };
  };

  /** The hero when it exists, belongs to this account and is not deleted; otherwise null. */
  findOwned = async (
    heroId: string,
    userId: string,
  ): Promise<{ id: string; isSandbox: boolean } | null> => {
    const [record] = await this.db
      .select({ id: heroes.id, isSandbox: heroes.isSandbox })
      .from(heroes)
      .where(and(eq(heroes.id, heroId), eq(heroes.userId, userId), isNull(heroes.deletedAt)))
      .limit(1);
    return record ?? null;
  };

  /**
   * Registration never creates a hero row on its own — this is the actual
   * creation point, called lazily from GET /heroes/me so both a fresh
   * registration and any pre-existing heroless account self-heal on next
   * fetch. The hero row and its aggregates are written in one transaction; a
   * per-account advisory lock stops two parallel first requests from creating
   * two heroes.
   */
  async findOrCreateByUserId(userId: string): Promise<IHero> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      await createInitialAggregates(this.db, existing.id);
      return existing;
    }

    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const [again] = await tx
        .select()
        .from(heroes)
        .where(and(eq(heroes.userId, userId), isNull(heroes.deletedAt)))
        .orderBy(asc(heroes.createdAt), asc(heroes.id))
        .limit(1);
      if (again) {
        await createInitialAggregates(tx, again.id);
        return { id: again.id, name: again.name, ...HeroDataSchema.parse(again.data) };
      }

      const [userRecord] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const data = starterHeroData();
      const [record] = await tx
        .insert(heroes)
        .values({ userId, name: userRecord?.name ?? 'Hero', data })
        .returning();
      await createInitialAggregates(tx, record.id);

      return { id: record.id, name: record.name, ...data };
    });
  }

  /**
   * Writes the hero's canonical position back to `heroes.data`. Callers pass
   * a transaction-scoped `db` (e.g. from `ScenarioStateService.release()`) so
   * this update lands atomically with whatever else the caller is persisting.
   */
  updateLocation = async (
    heroId: string,
    heroLocation: IHexCoordinates,
    heroSteps: number,
    db: Db = this.db,
  ): Promise<void> => {
    const [record] = await db.select().from(heroes).where(eq(heroes.id, heroId)).limit(1);
    if (!record) {
      return;
    }

    const data = HeroDataSchema.parse(record.data);
    await db
      .update(heroes)
      .set({ data: { ...data, heroLocation, heroSteps }, updatedAt: new Date().toISOString() })
      .where(eq(heroes.id, heroId));
  };
}

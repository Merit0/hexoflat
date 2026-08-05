import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { DB, type Db } from '../db/db.module';
import { heroes, users } from '../db/schema';
import { HeroDataSchema, type HeroData } from './heroes.dto';

// A fresh hero's base stats. HP starts small (10, not the 100 a hero can
// eventually grow into) — see the "0/100" bug this was chasing: nothing ever
// created a heroes row for a new user, so the frontend fell back to
// HeroModel's blank-slate defaults (0 current / 100 max) instead of a real,
// intentional starting value.
function starterHeroData(): HeroData {
  return {
    currentHealth: 10,
    maxHealth: 10,
    attack: 1,
    defense: 1,
    coins: 0,
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

  async findByUserId(userId: string): Promise<IHero | null> {
    const [record] = await this.db.select().from(heroes).where(eq(heroes.userId, userId)).limit(1);
    if (!record) {
      return null;
    }
    const data = HeroDataSchema.parse(record.data);
    return { id: record.id, name: record.name, ...data };
  }

  /**
   * Registration never creates a hero row on its own — this is the actual
   * creation point, called lazily from GET /heroes/me so both a fresh
   * registration and any pre-existing heroless account self-heal on next
   * fetch instead of staying stuck on the client's blank-slate fallback.
   */
  async findOrCreateByUserId(userId: string): Promise<IHero> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const [userRecord] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const data = starterHeroData();
    const [record] = await this.db
      .insert(heroes)
      .values({ userId, name: userRecord?.name ?? 'Hero', data })
      .returning();

    return { id: record.id, name: record.name, ...data };
  }

  /**
   * Writes the hero's canonical position back to `heroes.data`. Callers pass
   * a transaction-scoped `db` (e.g. from `ScenarioStateService.release()`) so
   * this update lands atomically with whatever else the caller is persisting.
   */
  async updateLocation(
    heroId: string,
    heroLocation: IHexCoordinates,
    heroSteps: number,
    db: Db = this.db,
  ): Promise<void> {
    const [record] = await db.select().from(heroes).where(eq(heroes.id, heroId)).limit(1);
    if (!record) {
      return;
    }

    const data = HeroDataSchema.parse(record.data);
    await db
      .update(heroes)
      .set({ data: { ...data, heroLocation, heroSteps }, updatedAt: new Date().toISOString() })
      .where(eq(heroes.id, heroId));
  }
}

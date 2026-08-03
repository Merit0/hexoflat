import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { DB, type Db } from '../db/db.module';
import { heroes } from '../db/schema';
import { HeroDataSchema } from './heroes.dto';

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

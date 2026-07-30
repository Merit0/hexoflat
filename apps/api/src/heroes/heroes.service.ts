import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { IHero } from '@hexoflat/engine/abstraction/hero-abstraction';
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
}

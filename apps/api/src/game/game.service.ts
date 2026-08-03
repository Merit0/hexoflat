import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { campaigns, saves } from '../db/schema';
import type { CreateSaveDto } from './game.dto';

export interface SaveRecord {
  id: string;
  campaignId: string;
  name: string;
  createdAt: string;
}

const SAVE_COLUMNS = {
  id: saves.id,
  campaignId: saves.campaignId,
  name: saves.name,
  createdAt: saves.createdAt,
};

@Injectable()
export class GameService {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(DB) private readonly db: Db) {}

  list(userId: string): Promise<SaveRecord[]> {
    return this.db
      .select(SAVE_COLUMNS)
      .from(saves)
      .innerJoin(campaigns, eq(saves.campaignId, campaigns.id))
      .where(eq(campaigns.ownerId, userId))
      .orderBy(desc(saves.createdAt));
  }

  async create(userId: string, dto: CreateSaveDto): Promise<SaveRecord> {
    const [campaign] = await this.db
      .select({ ownerId: campaigns.ownerId })
      .from(campaigns)
      .where(eq(campaigns.id, dto.campaignId))
      .limit(1);

    if (!campaign || campaign.ownerId !== userId) {
      throw new ForbiddenException('Not authorized for this campaign.');
    }

    const [record] = await this.db
      .insert(saves)
      .values({ campaignId: dto.campaignId, name: dto.name })
      .returning(SAVE_COLUMNS);
    return record;
  }
}

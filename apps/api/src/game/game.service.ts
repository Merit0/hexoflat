import { Inject, Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module';
import { saves } from '../db/schema';
import type { CreateSaveDto } from './game.dto';

export interface SaveRecord {
  id: string;
  name: string;
  createdAt: string;
}

const SAVE_COLUMNS = { id: saves.id, name: saves.name, createdAt: saves.createdAt };

@Injectable()
export class GameService {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(DB) private readonly db: Db) {}

  list(): Promise<SaveRecord[]> {
    return this.db.select(SAVE_COLUMNS).from(saves).orderBy(desc(saves.createdAt));
  }

  async create(dto: CreateSaveDto): Promise<SaveRecord> {
    const [record] = await this.db.insert(saves).values({ name: dto.name }).returning(SAVE_COLUMNS);
    return record;
  }
}

import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { TEST_DATABASE_URL } from '../test-support/test-database-url';
import type { Db } from '../db/db.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { HeroesService } from '../heroes/heroes.service';
import { PlayerCommandService } from './player-command.service';

export interface TestKit {
  db: Db;
  heroes: HeroesService;
  service: PlayerCommandService;
  close(): Promise<void>;
  newPlayer(): Promise<{ userId: string; heroId: string }>;
}

export function createTestKit(wrap: (db: Db) => Db = (db) => db): TestKit {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 20 });
  const db: Db = drizzle(pool, { schema });
  const heroes = new HeroesService(db);
  const service = new PlayerCommandService(wrap(db), heroes);
  return {
    db,
    heroes,
    service,
    close: () => pool.end(),
    async newPlayer() {
      const [user] = await db
        .insert(users)
        .values({ username: `p-${randomUUID()}`, password: 'x', name: 'Tester' })
        .returning({ id: users.id });
      const hero = await heroes.findOrCreateByUserId(user.id);
      return { userId: user.id, heroId: hero.id };
    },
  };
}

export function envelope(
  heroId: string,
  type: string,
  payload: Record<string, unknown>,
  expectedRevision: number,
  extra: { commandId?: string; aggregate?: string } = {},
) {
  return {
    commandId: extra.commandId ?? randomUUID(),
    heroId,
    aggregate: extra.aggregate ?? 'inventory',
    expectedRevision,
    command: { type, payload: { heroId, revision: expectedRevision, ...payload } },
  };
}

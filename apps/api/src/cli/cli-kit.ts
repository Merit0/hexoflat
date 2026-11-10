import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabaseUrl } from '../db/env';
import * as schema from '../db/schema';
import { HeroesService } from '../heroes/heroes.service';
import { PlayerCommandService } from '../player/player-command.service';

export async function withKit<T>(
  run: (kit: {
    db: ReturnType<typeof drizzle<typeof schema>>;
    heroes: HeroesService;
    commands: PlayerCommandService;
  }) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  try {
    const db = drizzle(pool, { schema });
    const heroes = new HeroesService(db);
    return await run({ db, heroes, commands: new PlayerCommandService(db, heroes) });
  } finally {
    await pool.end();
  }
}

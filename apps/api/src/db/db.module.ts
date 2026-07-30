import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getDatabaseUrl } from './env';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export type Db = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: getDatabaseUrl() }),
    },
    {
      provide: DB,
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
      inject: [PG_POOL],
    },
  ],
  exports: [DB],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

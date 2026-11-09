import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import type { TestProject } from 'vitest/node';
import { TEST_DATABASE_URL } from './test-database-url';

declare module 'vitest' {
  export interface ProvidedContext {
    dbAvailable: boolean;
  }
}

async function ensureDatabase(url: URL): Promise<void> {
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (found.rowCount === 0) await client.query(`create database "${name.replace(/"/g, '')}"`);
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject): Promise<void> {
  try {
    await ensureDatabase(new URL(TEST_DATABASE_URL));
    const pool = new Pool({ connectionString: TEST_DATABASE_URL });
    try {
      const folder = fileURLToPath(new URL('../../drizzle', import.meta.url));
      await migrate(drizzle(pool), { migrationsFolder: folder });
    } finally {
      await pool.end();
    }
    project.provide('dbAvailable', true);
  } catch (error) {
    if (process.env.CI) throw error;
    console.warn('Postgres test database is not reachable, integration tests are skipped:', error);
    project.provide('dbAvailable', false);
  }
}

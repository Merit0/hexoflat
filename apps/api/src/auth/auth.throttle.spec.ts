import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { DB, type Db } from '../db/db.module';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { AuthModule } from './auth.module';

// Empty result set for every `select().from().where().limit()` call — enough
// for AuthService.login to see "no such user" (401) without ever reaching
// the code path that would need a real row shape.
function createEmptyFakeDb(): Db {
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  };
  return db as unknown as Db;
}

function createTestDbModule(db: Db) {
  @Global()
  @Module({ providers: [{ provide: DB, useValue: db }], exports: [DB] })
  class TestDbModule {}
  return TestDbModule;
}

// Full HTTP-level bootstrap (not a bare `new AuthController(...)` like
// auth.controller.spec.ts) — ThrottlerGuard only runs as part of Nest's real
// request pipeline, so this is the only way to actually exercise the 429
// behavior instead of asserting against mocked guard internals.
describe('AuthController rate limiting (real HTTP pipeline)', () => {
  let app: NestFastifyApplication;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestDbModule(createEmptyFakeDb()), JwtAuthModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rate-limits POST /auth/login after 5 attempts within the window', async () => {
    const attempt = () =>
      fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nobody', password: 'wrong' }),
      });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await attempt();
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it('never rate-limits GET /auth/session, even well past the per-route budget', async () => {
    // ThrottlerGuard buckets are per-route (class+handler), so this doesn't
    // share login's bucket from the test above — it has its own 5-req/60s
    // budget that @SkipThrottle() removes entirely. Firing well past that
    // number here proves the regression this guards against: a handful of
    // ordinary page refreshes (each calling this once on boot) must never be
    // able to lock a valid session out on its own.
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const response = await fetch(`${url}/auth/session`);
      statuses.push(response.status);
    }

    expect(statuses.every((status) => status === 401)).toBe(true);
  });
});

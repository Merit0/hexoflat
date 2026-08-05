import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

// The real `eq()` returns an opaque SQL expression tree the fake db below
// can't inspect, so we swap it for a tiny tagged object the fake can read
// (`column`/`value`) — same pattern as game.service.spec.ts. Real
// jwt-auth.guard.ts code is unaffected type-wise, only this file's runtime.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ __eq: true, column, value }),
  };
});

import { users } from '../db/schema';
import type { Db } from '../db/db.module';
import { JwtAuthGuard, type AuthenticatedUser } from './jwt-auth.guard';

interface EqCondition {
  __eq: true;
  column: unknown;
  value: unknown;
}

function isEq(condition: unknown): condition is EqCondition {
  return !!condition && typeof condition === 'object' && (condition as EqCondition).__eq === true;
}

function createFakeDb(tokenVersionByUserId: Record<string, number>): Db {
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: () => {
            if (!isEq(condition) || condition.column !== users.id) {
              return Promise.resolve([]);
            }
            const tokenVersion = tokenVersionByUserId[condition.value as string];
            return Promise.resolve(tokenVersion === undefined ? [] : [{ tokenVersion }]);
          },
        }),
      }),
    }),
  };

  return db as unknown as Db;
}

function createFakeJwtService(verify: (token: string) => Promise<unknown>): JwtService {
  return { verifyAsync: vi.fn(verify) } as unknown as JwtService;
}

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: FastifyRequest & { user?: AuthenticatedUser };
} {
  const request = { headers: { authorization } } as FastifyRequest & { user?: AuthenticatedUser };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  it('rejects when there is no bearer token', async () => {
    const { context } = createContext(undefined);
    const guard = new JwtAuthGuard(
      createFakeJwtService(() => Promise.resolve({})),
      createFakeDb({}),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid or expired token', async () => {
    const { context } = createContext('Bearer bad-token');
    const guard = new JwtAuthGuard(
      createFakeJwtService(() => Promise.reject(new Error('bad signature'))),
      createFakeDb({}),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a token whose tokenVersion still matches the stored value', async () => {
    const userId = randomUUID();
    const { context, request } = createContext('Bearer good-token');
    const guard = new JwtAuthGuard(
      createFakeJwtService(() => Promise.resolve({ sub: userId, tokenVersion: 0 })),
      createFakeDb({ [userId]: 0 }),
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: userId });
  });

  it('rejects a token issued before a logout bumped the stored tokenVersion', async () => {
    const userId = randomUUID();
    const { context } = createContext('Bearer stale-token');
    const guard = new JwtAuthGuard(
      createFakeJwtService(() => Promise.resolve({ sub: userId, tokenVersion: 0 })),
      createFakeDb({ [userId]: 1 }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token for a user that no longer exists', async () => {
    const userId = randomUUID();
    const { context } = createContext('Bearer orphan-token');
    const guard = new JwtAuthGuard(
      createFakeJwtService(() => Promise.resolve({ sub: userId, tokenVersion: 0 })),
      createFakeDb({}),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});

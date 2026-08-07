import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Same trick as jwt-auth.guard.spec.ts: the real `eq()` returns an opaque SQL
// expression tree the fake db below can't inspect, so swap it for a tiny
// tagged object the fake can read (`column`/`value`).
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ __eq: true, column, value }),
  };
});

import { users } from '../db/schema';
import type { Db } from '../db/db.module';
import { AuthController, SESSION_COOKIE_MAX_AGE_SECONDS } from './auth.controller';
import type { AuthService, AuthResult } from './auth.service';
import type { AuthenticatedRequest } from './jwt-auth.guard';

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

function createFakeAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn(),
    ...overrides,
  } as unknown as AuthService;
}

function createFakeReply(): {
  reply: FastifyReply;
  setCookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
} {
  const setCookie = vi.fn();
  const clearCookie = vi.fn();
  return { reply: { setCookie, clearCookie } as unknown as FastifyReply, setCookie, clearCookie };
}

function createRequestWithCookie(session?: string): FastifyRequest {
  return { cookies: { session } } as unknown as FastifyRequest;
}

const SOME_AUTH_RESULT: AuthResult = {
  user: { id: randomUUID(), username: 'merito', name: 'Merito' },
  accessToken: 'fresh-access-token',
};

describe('AuthController', () => {
  it('login sets an httpOnly session cookie carrying the access token', async () => {
    const authService = createFakeAuthService({
      login: vi.fn().mockResolvedValue(SOME_AUTH_RESULT),
    });
    const controller = new AuthController(authService, createFakeJwtService(vi.fn()), {} as Db);
    const { reply, setCookie } = createFakeReply();

    const result = await controller.login(
      { username: 'merito', password: 'secret', rememberMe: false },
      reply,
    );

    expect(result).toBe(SOME_AUTH_RESULT);
    expect(setCookie).toHaveBeenCalledWith(
      'session',
      SOME_AUTH_RESULT.accessToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('login with rememberMe: true sets a persistent cookie with maxAge', async () => {
    const authService = createFakeAuthService({
      login: vi.fn().mockResolvedValue(SOME_AUTH_RESULT),
    });
    const controller = new AuthController(authService, createFakeJwtService(vi.fn()), {} as Db);
    const { reply, setCookie } = createFakeReply();

    await controller.login({ username: 'merito', password: 'secret', rememberMe: true }, reply);

    expect(setCookie).toHaveBeenCalledWith(
      'session',
      SOME_AUTH_RESULT.accessToken,
      expect.objectContaining({ maxAge: SESSION_COOKIE_MAX_AGE_SECONDS }),
    );
  });

  it('login with rememberMe: false sets a session cookie without maxAge', async () => {
    const authService = createFakeAuthService({
      login: vi.fn().mockResolvedValue(SOME_AUTH_RESULT),
    });
    const controller = new AuthController(authService, createFakeJwtService(vi.fn()), {} as Db);
    const { reply, setCookie } = createFakeReply();

    await controller.login({ username: 'merito', password: 'secret', rememberMe: false }, reply);

    const [, , options] = setCookie.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(options).not.toHaveProperty('maxAge');
  });

  it('register sets an httpOnly session cookie carrying the access token', async () => {
    const authService = createFakeAuthService({
      register: vi.fn().mockResolvedValue(SOME_AUTH_RESULT),
    });
    const controller = new AuthController(authService, createFakeJwtService(vi.fn()), {} as Db);
    const { reply, setCookie } = createFakeReply();

    const result = await controller.register(
      { username: 'merito', password: 'secretpw', name: 'Merito' },
      reply,
    );

    expect(result).toBe(SOME_AUTH_RESULT);
    expect(setCookie).toHaveBeenCalledWith(
      'session',
      SOME_AUTH_RESULT.accessToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('logout bumps tokenVersion and clears the session cookie', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const authService = createFakeAuthService({ logout });
    const controller = new AuthController(authService, createFakeJwtService(vi.fn()), {} as Db);
    const { reply, clearCookie } = createFakeReply();
    const request = { user: { sub: 'user-1' } } as AuthenticatedRequest;

    await controller.logout(request, reply);

    expect(logout).toHaveBeenCalledWith('user-1');
    expect(clearCookie).toHaveBeenCalledWith('session', { path: '/' });
  });

  describe('GET /auth/session', () => {
    it('returns a fresh access token for a valid session cookie', async () => {
      const userId = randomUUID();
      const refreshSession = vi.fn().mockResolvedValue(SOME_AUTH_RESULT);
      const authService = createFakeAuthService({ refreshSession });
      const controller = new AuthController(
        authService,
        createFakeJwtService(() => Promise.resolve({ sub: userId, tokenVersion: 0 })),
        createFakeDb({ [userId]: 0 }),
      );

      const result = await controller.session(createRequestWithCookie('good-token'));

      expect(result).toBe(SOME_AUTH_RESULT);
      expect(refreshSession).toHaveBeenCalledWith(userId);
    });

    it('rejects when there is no session cookie', async () => {
      const controller = new AuthController(
        createFakeAuthService(),
        createFakeJwtService(vi.fn()),
        {} as Db,
      );

      await expect(controller.session(createRequestWithCookie(undefined))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an invalid or expired session cookie', async () => {
      const controller = new AuthController(
        createFakeAuthService(),
        createFakeJwtService(() => Promise.reject(new Error('bad signature'))),
        createFakeDb({}),
      );

      await expect(controller.session(createRequestWithCookie('bad-token'))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a session cookie issued before a logout bumped the stored tokenVersion', async () => {
      const userId = randomUUID();
      const controller = new AuthController(
        createFakeAuthService(),
        createFakeJwtService(() => Promise.resolve({ sub: userId, tokenVersion: 0 })),
        createFakeDb({ [userId]: 1 }),
      );

      await expect(controller.session(createRequestWithCookie('stale-token'))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

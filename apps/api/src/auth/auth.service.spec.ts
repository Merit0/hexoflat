import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Db } from '../db/db.module';
import { AuthService } from './auth.service';

interface FakeUserRow {
  id: string;
  username: string;
  password: string;
  name: string;
  tokenVersion: number;
}

// Only one seed user is ever used per test, so the fake db doesn't need to
// evaluate the drizzle `where(eq(...))` expression — it just returns
// whatever rows are seeded/inserted so far.
function createFilteringFakeDb(seedRows: Omit<FakeUserRow, 'tokenVersion'>[] = []) {
  const rows: FakeUserRow[] = seedRows.map((row) => ({ ...row, tokenVersion: 0 }));

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([...rows]),
        }),
      }),
    }),
    insert: () => ({
      values: (row: { username: string; password: string; name: string }) => ({
        returning: () => {
          const record: FakeUserRow = { id: randomUUID(), tokenVersion: 0, ...row };
          rows.push(record);
          return Promise.resolve([record]);
        },
      }),
    }),
    update: () => ({
      set: (patch: { tokenVersion: unknown }) => ({
        where: () => {
          // Fake stands in for `sql`${users.tokenVersion} + 1`` — the real
          // expression isn't evaluable here, so just apply the "+1" it means.
          void patch;
          for (const row of rows) row.tokenVersion += 1;
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db: db as unknown as Db, rows };
}

function createFakeJwtService(): JwtService {
  return { signAsync: vi.fn().mockResolvedValue('fake-jwt-token') } as unknown as JwtService;
}

describe('AuthService', () => {
  it('registers a new user, hashing the password before persisting it', async () => {
    const { db, rows } = createFilteringFakeDb();
    const service = new AuthService(db, createFakeJwtService());

    const result = await service.register({
      username: 'merito',
      password: 'secret',
      name: 'Merito',
    });

    expect(result.user).toMatchObject({ username: 'merito', name: 'Merito' });
    expect(result.accessToken).toBe('fake-jwt-token');
    expect(rows[0].password).not.toBe('secret');
    expect(await bcrypt.compare('secret', rows[0].password)).toBe(true);
  });

  it('rejects registering a duplicate username', async () => {
    const { db } = createFilteringFakeDb([
      {
        id: randomUUID(),
        username: 'merito',
        password: await bcrypt.hash('secret', 10),
        name: 'Merito',
      },
    ]);
    const service = new AuthService(db, createFakeJwtService());

    await expect(
      service.register({ username: 'merito', password: 'other', name: 'Merito2' }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in with matching credentials and returns an access token', async () => {
    const { db } = createFilteringFakeDb([
      {
        id: randomUUID(),
        username: 'merito',
        password: await bcrypt.hash('secret', 10),
        name: 'Merito',
      },
    ]);
    const service = new AuthService(db, createFakeJwtService());

    const result = await service.login({
      username: 'merito',
      password: 'secret',
      rememberMe: false,
    });

    expect(result.user.username).toBe('merito');
    expect(result.accessToken).toBe('fake-jwt-token');
  });

  it('rejects login with wrong credentials', async () => {
    const { db } = createFilteringFakeDb([
      {
        id: randomUUID(),
        username: 'merito',
        password: await bcrypt.hash('secret', 10),
        name: 'Merito',
      },
    ]);
    const service = new AuthService(db, createFakeJwtService());

    await expect(
      service.login({ username: 'merito', password: 'wrong', rememberMe: false }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for an unknown username', async () => {
    const { db } = createFilteringFakeDb();
    const service = new AuthService(db, createFakeJwtService());

    await expect(
      service.login({ username: 'ghost', password: 'whatever', rememberMe: false }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('embeds the current tokenVersion as a claim when issuing a token', async () => {
    const { db } = createFilteringFakeDb([
      {
        id: randomUUID(),
        username: 'merito',
        password: await bcrypt.hash('secret', 10),
        name: 'Merito',
      },
    ]);
    const signAsync = vi.fn().mockResolvedValue('fake-jwt-token');
    const service = new AuthService(db, { signAsync } as unknown as JwtService);

    await service.login({ username: 'merito', password: 'secret', rememberMe: false });

    expect(signAsync).toHaveBeenCalledWith(expect.objectContaining({ tokenVersion: 0 }));
  });

  it('logout bumps tokenVersion, invalidating tokens issued before the call', async () => {
    const { db, rows } = createFilteringFakeDb([
      {
        id: randomUUID(),
        username: 'merito',
        password: await bcrypt.hash('secret', 10),
        name: 'Merito',
      },
    ]);
    const service = new AuthService(db, createFakeJwtService());

    await service.logout(rows[0].id);

    expect(rows[0].tokenVersion).toBe(1);
  });
});

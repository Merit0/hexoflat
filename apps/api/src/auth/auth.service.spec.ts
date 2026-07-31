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
}

// Only one seed user is ever used per test, so the fake db doesn't need to
// evaluate the drizzle `where(eq(...))` expression — it just returns
// whatever rows are seeded/inserted so far.
function createFilteringFakeDb(seedRows: FakeUserRow[] = []) {
  const rows = [...seedRows];

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
          const record: FakeUserRow = { id: randomUUID(), ...row };
          rows.push(record);
          return Promise.resolve([record]);
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

    const result = await service.login({ username: 'merito', password: 'secret' });

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

    await expect(service.login({ username: 'merito', password: 'wrong' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects login for an unknown username', async () => {
    const { db } = createFilteringFakeDb();
    const service = new AuthService(db, createFakeJwtService());

    await expect(service.login({ username: 'ghost', password: 'whatever' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

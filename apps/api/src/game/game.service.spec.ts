import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/db.module';
import { GameService, type SaveRecord } from './game.service';

function createFakeDb(): Db {
  const rows: SaveRecord[] = [];
  return {
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve([...rows].reverse()),
      }),
    }),
    insert: () => ({
      values: ({ name }: { name: string }) => ({
        returning: () => {
          const record: SaveRecord = {
            id: randomUUID(),
            name,
            createdAt: new Date().toISOString(),
          };
          rows.push(record);
          return Promise.resolve([record]);
        },
      }),
    }),
  } as unknown as Db;
}

describe('GameService', () => {
  it('creates and lists saves', async () => {
    const service = new GameService(createFakeDb());
    expect(await service.list()).toEqual([]);

    const created = await service.create({ name: 'campaign-1' });
    expect(created).toMatchObject({ name: 'campaign-1' });
    expect(await service.list()).toEqual([created]);
  });
});

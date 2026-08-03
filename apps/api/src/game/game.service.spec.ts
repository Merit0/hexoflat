import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';

// Faking Drizzle's query builder can't introspect the opaque SQL node `eq()`
// produces, so we swap it for a tiny tagged object the fakes below can read
// (`column`/`value`) — real `game.service.ts` code is unaffected type-wise,
// only this test file's runtime behavior changes.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ __eq: true, column, value }),
  };
});

import { campaigns } from '../db/schema';
import type { Db } from '../db/db.module';
import { GameService, type SaveRecord } from './game.service';

interface EqCondition {
  __eq: true;
  column: unknown;
  value: unknown;
}

function isEq(condition: unknown): condition is EqCondition {
  return !!condition && typeof condition === 'object' && (condition as EqCondition).__eq === true;
}

function createFakeDb(campaignOwners: Record<string, string>): Db {
  const rows: SaveRecord[] = [];

  const db = {
    select: () => ({
      from: (table: unknown) => {
        if (table === campaigns) {
          return {
            where: (condition: unknown) => ({
              limit: () => {
                if (!isEq(condition) || condition.column !== campaigns.id) {
                  return Promise.resolve([]);
                }
                const ownerId = campaignOwners[condition.value as string];
                return Promise.resolve(ownerId ? [{ ownerId }] : []);
              },
            }),
          };
        }

        // saves innerJoin campaigns
        return {
          innerJoin: () => ({
            where: (condition: unknown) => ({
              orderBy: () => {
                if (!isEq(condition) || condition.column !== campaigns.ownerId) {
                  return Promise.resolve([]);
                }
                const ownerId = condition.value as string;
                return Promise.resolve(
                  rows.filter((r) => campaignOwners[r.campaignId] === ownerId).reverse(),
                );
              },
            }),
          }),
        };
      },
    }),
    insert: () => ({
      values: ({ campaignId, name }: { campaignId: string; name: string }) => ({
        returning: () => {
          const record: SaveRecord = {
            id: randomUUID(),
            campaignId,
            name,
            createdAt: new Date().toISOString(),
          };
          rows.push(record);
          return Promise.resolve([record]);
        },
      }),
    }),
  };

  return db as unknown as Db;
}

describe('GameService', () => {
  it('scopes create + list to saves whose campaign the user owns', async () => {
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const campaignId = randomUUID();
    const otherCampaignId = randomUUID();

    const service = new GameService(
      createFakeDb({ [campaignId]: ownerId, [otherCampaignId]: otherOwnerId }),
    );

    expect(await service.list(ownerId)).toEqual([]);

    const created = await service.create(ownerId, { campaignId, name: 'save-1' });
    expect(created).toMatchObject({ campaignId, name: 'save-1' });
    expect(await service.list(ownerId)).toEqual([created]);
    expect(await service.list(otherOwnerId)).toEqual([]);
  });

  it('rejects creating a save in a campaign the user does not own', async () => {
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const campaignId = randomUUID();

    const service = new GameService(createFakeDb({ [campaignId]: ownerId }));

    await expect(
      service.create(otherOwnerId, { campaignId, name: 'save-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects creating a save for an unknown campaign', async () => {
    const service = new GameService(createFakeDb({}));

    await expect(
      service.create(randomUUID(), { campaignId: randomUUID(), name: 'save-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { heroes, users } from '../db/schema';
import { createTestKit, type TestKit } from '../player/player-test-kit';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('DA2 D8: heroes.data write path (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  async function heroWithExtraField(): Promise<{ userId: string; heroId: string }> {
    const [user] = await kit.db
      .insert(users)
      .values({ username: `d8-${randomUUID()}`, password: 'x', name: 'D8' })
      .returning({ id: users.id });
    const hero = await kit.heroes.findOrCreateByUserId(user.id);
    const [row] = await kit.db.select().from(heroes).where(eq(heroes.id, hero.id));
    await kit.db
      .update(heroes)
      .set({ data: { ...(row.data as Record<string, unknown>), origin: 'nowhere' } })
      .where(eq(heroes.id, hero.id));
    return { userId: user.id, heroId: hero.id };
  }

  async function storedData(heroId: string): Promise<Record<string, unknown>> {
    const [row] = await kit.db.select().from(heroes).where(eq(heroes.id, heroId));
    return row.data as Record<string, unknown>;
  }

  it('D8: an unknown field written into heroes.data is stored by Postgres', async () => {
    const { heroId } = await heroWithExtraField();
    expect(await storedData(heroId)).toMatchObject({ origin: 'nowhere' });
  });

  it('CURRENT (D8): the read path drops the unknown field from the returned hero', async () => {
    const { userId, heroId } = await heroWithExtraField();
    const hero = await kit.heroes.findByUserId(userId);
    expect(hero).not.toHaveProperty('origin');
    expect(await storedData(heroId)).toMatchObject({ origin: 'nowhere' });
  });

  it('CURRENT (D8): updateLocation silently erases the unknown field from heroes.data', async () => {
    const { heroId } = await heroWithExtraField();
    await kit.heroes.updateLocation(heroId, { columnIndex: 4, rowIndex: 5 }, 7);
    const data = await storedData(heroId);
    expect(data).not.toHaveProperty('origin');
    expect(data).toMatchObject({
      heroLocation: { columnIndex: 4, rowIndex: 5 },
      heroSteps: 7,
      currentHealth: 3,
    });
  });
});

import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module';
import { expeditionBlobs, expeditionMembers, expeditions } from '../db/schema';
import type { Executor, Tx } from '../player/aggregate-store';

export const BLOB_KEY_PATTERN =
  /^(?:(?:map|state):[0-9a-f-]{36}|index|respawn|nav|progress|hero-store)$/;
export const MAX_BLOB_BYTES = 3 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
export const MAX_BLOB_KEYS = 64;

export type ExpeditionRefusal =
  'BAD_KEY' | 'BAD_JSON' | 'BLOB_TOO_LARGE' | 'EXPEDITION_TOO_LARGE' | 'TOO_MANY_KEYS';

export class ExpeditionError extends Error {
  constructor(readonly code: ExpeditionRefusal) {
    super(code);
  }
}

/** The hero's active solo expedition; created on first use. Co-op later adds members, not tables. */
export async function ensureExpedition(db: Db, userId: string, heroId: string): Promise<string> {
  const find = (exec: Executor) =>
    exec
      .select({ id: expeditionMembers.expeditionId })
      .from(expeditionMembers)
      .innerJoin(expeditions, eq(expeditions.id, expeditionMembers.expeditionId))
      .where(
        and(
          eq(expeditionMembers.heroId, heroId),
          isNull(expeditionMembers.leftAt),
          eq(expeditions.status, 'active'),
        ),
      )
      .limit(1);

  const [existing] = await find(db);
  if (existing) return existing.id;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`expedition:${heroId}`}))`);
    const [again] = await find(tx);
    if (again) return again.id;
    const [created] = await tx
      .insert(expeditions)
      .values({ hostUserId: userId, kind: 'world', seed: randomBytes(16).toString('hex') })
      .returning({ id: expeditions.id });
    await tx
      .insert(expeditionMembers)
      .values({ expeditionId: created.id, heroId, controlledByUserId: userId });
    return created.id;
  });
}

export async function loadBlobs(
  db: Executor,
  expeditionId: string,
): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: expeditionBlobs.key, data: expeditionBlobs.data })
    .from(expeditionBlobs)
    .where(eq(expeditionBlobs.expeditionId, expeditionId));
  return Object.fromEntries(rows.map((row) => [row.key, row.data]));
}

export function validatePut(put: Record<string, string>): void {
  for (const [key, data] of Object.entries(put)) {
    if (!BLOB_KEY_PATTERN.test(key)) throw new ExpeditionError('BAD_KEY');
    if (Buffer.byteLength(data) > MAX_BLOB_BYTES) throw new ExpeditionError('BLOB_TOO_LARGE');
    try {
      JSON.parse(data);
    } catch {
      throw new ExpeditionError('BAD_JSON');
    }
  }
}

export async function patchBlobs(
  db: Db,
  expeditionId: string,
  put: Record<string, string>,
  remove: readonly string[],
): Promise<number> {
  validatePut(put);
  if (remove.some((key) => !BLOB_KEY_PATTERN.test(key))) throw new ExpeditionError('BAD_KEY');
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ revision: expeditions.revision })
      .from(expeditions)
      .where(eq(expeditions.id, expeditionId))
      .for('update');
    for (const key of remove) {
      await tx
        .delete(expeditionBlobs)
        .where(and(eq(expeditionBlobs.expeditionId, expeditionId), eq(expeditionBlobs.key, key)));
    }
    for (const [key, data] of Object.entries(put)) {
      await tx
        .insert(expeditionBlobs)
        .values({ expeditionId, key, data })
        .onConflictDoUpdate({
          target: [expeditionBlobs.expeditionId, expeditionBlobs.key],
          set: { data, updatedAt: new Date().toISOString() },
        });
    }
    const [{ keys, bytes }] = await tx
      .select({
        keys: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(octet_length(${expeditionBlobs.data})), 0)::int`,
      })
      .from(expeditionBlobs)
      .where(eq(expeditionBlobs.expeditionId, expeditionId));
    if (keys > MAX_BLOB_KEYS) throw new ExpeditionError('TOO_MANY_KEYS');
    if (bytes > MAX_TOTAL_BYTES) throw new ExpeditionError('EXPEDITION_TOO_LARGE');
    const revision = locked.revision + 1;
    await tx.update(expeditions).set({ revision }).where(eq(expeditions.id, expeditionId));
    return revision;
  });
}

/** Dev reset: the hero's world is forgotten too. */
export async function clearExpeditionBlobs(tx: Tx, heroId: string): Promise<void> {
  const members = await tx
    .select({ id: expeditionMembers.expeditionId })
    .from(expeditionMembers)
    .where(eq(expeditionMembers.heroId, heroId));
  for (const { id } of members) {
    await tx.delete(expeditionBlobs).where(eq(expeditionBlobs.expeditionId, id));
    await tx
      .update(expeditions)
      .set({ revision: sql`${expeditions.revision} + 1` })
      .where(eq(expeditions.id, id));
  }
}

import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coinPriceOf, getMeta } from './content-accessors';
import { CONTENT } from './content-map';
import { ContentDefinitionSchema, traderDefinitionSchema } from './content-schema';
import { TRADERS } from './traders.content';

export function validateContent(): void {
  const keys = Object.values(HEXOBJECT_KEYS) as THexobjectKey[];
  const failures: string[] = [];

  for (const key of keys) {
    const entry = CONTENT[key];
    if (!entry) {
      failures.push(`[${key}] missing content entry`);
      continue;
    }

    const result = ContentDefinitionSchema.safeParse(entry);
    if (!result.success) {
      failures.push(`[${key}] ${result.error.message}`);
    }
  }

  failures.push(...traderFailures(TRADERS));

  if (failures.length > 0) {
    throw new Error(`Hexobject content validation failed:\n${failures.join('\n')}`);
  }
}

function maxStackOf(key: THexobjectKey): number {
  const traits = getMeta(key).traits;
  if (!traits?.stackable) return 1;
  return traits.maxStack ?? Number.POSITIVE_INFINITY;
}

export function traderProblems(recordKey: string, raw: unknown): string[] {
  const parsed = traderDefinitionSchema.safeParse(raw);
  if (!parsed.success) return [parsed.error.message];
  const trader = parsed.data;
  const problems: string[] = [];

  if (trader.key !== recordKey) problems.push(`key "${trader.key}" differs from its record`);
  if (trader.sellRate.num >= trader.sellRate.den) problems.push('sellRate must be below 1');
  if (trader.guaranteed.length + trader.rolls > trader.goodsSlots) {
    problems.push('guaranteed + rolls exceed goodsSlots');
  }
  if (trader.rolls > trader.pool.length) problems.push('rolls exceed the distinct pool keys');

  const stock = [...trader.guaranteed, ...trader.pool];
  const seen = new Set<string>();
  for (const entry of stock) {
    if (seen.has(entry.key)) problems.push(`${entry.key} is listed twice`);
    seen.add(entry.key);
    if (coinPriceOf(entry.key) === null) problems.push(`${entry.key} has no coinPrice`);
    if (entry.min > entry.max) problems.push(`${entry.key} min is above max`);
    if (entry.max > maxStackOf(entry.key)) problems.push(`${entry.key} max is above its stack`);
  }
  return problems;
}

export function traderFailures(traders: Record<string, unknown>): string[] {
  return Object.entries(traders).flatMap(([key, raw]) =>
    traderProblems(key, raw).map((problem) => `[trader ${key}] ${problem}`),
  );
}

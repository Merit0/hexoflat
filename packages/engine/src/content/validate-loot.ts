import { BASE_ITEMS } from './base-items.content';
import { EChestType, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { BATTLE_CREATURES } from '../battle/battle-catalogue';
import { lootTableSchema } from '../loot/loot-table';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coinPriceOf } from './content-accessors';
import { CONTENT } from './content-map';
import { LOOT_TABLES } from './loot-tables.content';

export interface LootReference {
  owner: string;
  tableId: string | undefined;
}

export interface LootContentInput {
  tables: Record<string, unknown>;
  references: LootReference[];
  bosses: LootReference[];
  priceOf: (key: THexobjectKey) => number | null;
}

export function lootTableProblems(
  tables: Record<string, unknown>,
  priceOf: LootContentInput['priceOf'],
): string[] {
  const problems: string[] = [];
  for (const [recordKey, raw] of Object.entries(tables)) {
    const parsed = lootTableSchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(`[loot:${recordKey}] ${parsed.error.message}`);
      continue;
    }
    const table = parsed.data;
    if (table.id !== recordKey) problems.push(`[loot:${recordKey}] id "${table.id}" differs`);
    for (const { itemKey, baseKey } of [...(table.guaranteed ?? []), ...table.entries]) {
      if (baseKey && !BASE_ITEMS.some((entry) => entry.key === baseKey && entry.type === itemKey))
        problems.push(`[loot:${table.id}] invalid base reference ${baseKey} for ${itemKey}`);
      if (itemKey !== HEXOBJECT_KEYS.COINS && priceOf(itemKey) === null) {
        problems.push(`[loot:${table.id}] ${itemKey} is sellable loot without a coinPrice`);
      }
    }
  }
  return problems;
}

export function lootReferenceProblems(
  references: readonly LootReference[],
  tables: Record<string, unknown>,
): string[] {
  return references.flatMap(({ owner, tableId }) => {
    if (!tableId) return [`[${owner}] has no loot table`];
    return tableId in tables ? [] : [`[${owner}] unknown loot table "${tableId}"`];
  });
}

export function bossTableProblems(
  bosses: readonly LootReference[],
  tables: Record<string, unknown>,
): string[] {
  return bosses.flatMap(({ owner, tableId }) => {
    const parsed = lootTableSchema.safeParse(tableId ? tables[tableId] : undefined);
    if (!parsed.success) return [];
    return (parsed.data.guaranteed ?? []).length > 0
      ? []
      : [`[${owner}] a boss table needs guaranteed entries`];
  });
}

export function lootContentProblems(input: LootContentInput): string[] {
  return [
    ...lootTableProblems(input.tables, input.priceOf),
    ...lootReferenceProblems(input.references, input.tables),
    ...bossTableProblems(input.bosses, input.tables),
  ];
}

function realReferences(): { references: LootReference[]; bosses: LootReference[] } {
  const references: LootReference[] = [];
  const bosses: LootReference[] = [];
  for (const def of Object.values(BATTLE_CREATURES)) {
    if (def.behaviour === 'hero') continue;
    references.push({ owner: `creature:${def.id}`, tableId: def.lootTableId });
  }
  for (const entry of Object.values(CONTENT)) {
    if (entry.groupType === EHexobjectGroup.CONSTRUCTION) {
      const { chestType, lootTableId } = entry.construction;
      if (lootTableId || (chestType === EChestType.LOOT && entry.isInteractable)) {
        references.push({ owner: entry.hexobjectKey, tableId: lootTableId });
      }
    }
    const squad = entry.groupType === EHexobjectGroup.CREATURE ? entry.creature.squad : undefined;
    if (squad?.boss) {
      const leader = BATTLE_CREATURES[squad.members[0]];
      bosses.push({ owner: `boss:${entry.hexobjectKey}`, tableId: leader?.lootTableId });
    }
  }
  return { references, bosses };
}

export function lootContentFailures(): string[] {
  return lootContentProblems({
    tables: LOOT_TABLES,
    priceOf: coinPriceOf,
    ...realReferences(),
  });
}

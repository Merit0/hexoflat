import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import type { KnowledgeState } from './state';
import { grantWill } from './will';

export function grantEquipmentTaskWill(
  knowledge: KnowledgeState,
  inventory: InventoryState,
  resolved: readonly DomainEvent[],
): DomainEvent[] {
  const bonus = resolveHeroStats(Object.values(inventory.equip)).answerWillReward;
  if (bonus === 0) return [];
  const events: DomainEvent[] = [];
  for (const event of resolved) {
    if (event.type !== 'TASK_RESOLVED') continue;
    const task = event.payload as { creatureId: string; taskId: string; correct: boolean };
    if (task.creatureId !== knowledge.heroId || !task.correct) continue;
    const granted = grantWill(knowledge, bonus, { kind: 'task', ref: task.taskId });
    if (granted.length > 0) knowledge.revision += 1;
    events.push(...granted);
  }
  return events;
}

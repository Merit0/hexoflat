import type { DomainEvent } from '../commands/types';
import type { HeroStats } from '../tokens/equipment/hero-stats';
import { willCapacityOf } from './math';
import type { KnowledgeState } from './state';
import { spendWill } from './will';

export function syncEquipmentWill(
  knowledge: KnowledgeState,
  stats: Pick<HeroStats, 'maxWill'>,
): { knowledge: KnowledgeState; events: DomainEvent[] } {
  const capacity = willCapacityOf([{ source: 'equipment', additionalCapacity: stats.maxWill }]);
  if (knowledge.capacity === capacity) return { knowledge, events: [] };
  const next = structuredClone(knowledge);
  const spent = spendWill(
    next,
    Math.max(0, next.current - capacity),
    'equipment',
    'equipment-capacity',
  );
  next.capacity = capacity;
  next.revision += 1;
  return {
    knowledge: next,
    events: [
      ...spent.events,
      {
        type: 'WILL_CAPACITY_CHANGED',
        payload: {
          heroId: next.heroId,
          previousCapacity: knowledge.capacity,
          capacity,
          balanceAfter: next.current,
          revision: next.revision,
        },
      },
    ],
  };
}

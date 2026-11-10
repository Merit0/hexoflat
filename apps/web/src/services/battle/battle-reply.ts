import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import type { BattleStep } from '@/stores/battle-store';

export type BattleRequest =
  { kind: 'start' | 'run-enemy-turn' | 'close' | 'sync' } | { kind: 'hero'; action: BattleAction };

export interface BattleReply {
  ok: boolean;
  code: string | null;
  steps: BattleStep[];
  events: DomainEvent[];
  closed: boolean;
  result: WorldCommandResult | null;
}

import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleRules } from '@hexoflat/engine/battle/battle-content';
import type { BattleBehaviour } from '@hexoflat/engine/battle/battle-catalogue';
import type { BattleCreature, BattleHand, BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import type { BattleDeploy } from '@/stores/battle-store';
import type { NameOf } from './battle-hint';
import type { BattleStage } from './battle-stage';
import type { BattleUiMode } from './battle-board-tap';

export type BattleRowTag = 'yourTurn' | 'next' | 'done' | 'fallen';

import type { BattleRowHand } from './battle-row-hands';

export interface BattleCreatureRow {
  id: string;
  name: string;
  side: BattleCreature['side'];
  behaviour: BattleBehaviour;
  init: number | null;
  hp: number;
  maxHp: number;
  hands: BattleRowHand[];
  hits: number;
  stance: number;
  tags: BattleRowTag[];
  active: boolean;
  fallen: boolean;
  targeted: boolean;
  selected: boolean;
  block: 'blocking' | 'ready' | null;
}

export interface BattleUiState {
  stage: BattleStage;
  mode: BattleUiMode;
  hand: BattleHand | null;
  swapHand: BattleHand;
  hover: BattleHex | null;
  toolAt: BattleHex | null;
  selectedId?: string | null;
}

export interface BattleViewInput {
  deploy: BattleDeploy | null;
  projection: BattleProjection | null;
  localHeroIds: readonly string[];
  lastHeroEvents: DomainEvent[];
  turnStartWill: number;
  ui: BattleUiState;
  rules: BattleRules;
  nameOf: NameOf;
  revealedShields?: readonly BattleHex[];
}

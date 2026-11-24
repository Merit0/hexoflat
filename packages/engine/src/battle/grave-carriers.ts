import { dimensionOfTokenType, type EDimension } from '../dimensions/dimensions';
import type { DropContext } from '../tokens/drop-context';
import { isAlive } from './battle-board';
import { BATTLE_CREATURES, lootTableIdOfKind } from './battle-catalogue';
import type { BattleCreature, BattleHex, BattleState, Grave } from './battle-state';
import { sameHex } from './hex-battle-geom';

export interface GraveCarrier {
  creature: BattleCreature;
  tableId: string;
  dimension: EDimension;
}

export function fallenEnemies(state: BattleState): BattleCreature[] {
  const order = new Map((state.fallen ?? []).map((id, index) => [id, index]));
  const rank = (creature: BattleCreature) => order.get(creature.id) ?? Number.MAX_SAFE_INTEGER;
  return state.creatures
    .filter((creature) => creature.side === 'enemies' && !isAlive(creature))
    .sort((a, b) => rank(a) - rank(b));
}

export function graveCarriersAt(state: BattleState, hex: BattleHex): GraveCarrier[] {
  return fallenEnemies(state).flatMap((creature) => {
    const tableId = lootTableIdOfKind(creature.kind);
    return tableId && sameHex(creature.pos, hex)
      ? [{ creature, tableId, dimension: BATTLE_CREATURES[creature.kind].dimension }]
      : [];
  });
}

export function graveDimensions(
  state: BattleState,
  grave: Grave,
  dropContext: DropContext,
): EDimension[] {
  const known =
    grave.dimensions ?? graveCarriersAt(state, grave.hex).map((carrier) => carrier.dimension);
  const mapDimension = dimensionOfTokenType(dropContext.tokenType);
  return grave.tables.map((_, index) => known[index] ?? mapDimension);
}

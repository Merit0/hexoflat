import type HexMapModel from '../map/models/hex-map-model';
import {
  BATTLE_CREATURES,
  battleItem,
  battleItemOfHexobject,
  hexobjectOfBattleItem,
} from '../battle/battle-catalogue';
import type { BattleCreature, BattleState } from '../battle/battle-state';
import { battlefieldSeed, generateBattlefield, type Battlefield } from '../battle/battlefield';
import { approachDirection, deployBattle, type Deployment, type Vector } from './battlefield-setup';
import { encounterDef } from './encounter-content';
import { findEncounter } from './encounter-state';
import type { Engagement } from './encounter-commands';

export interface HeroLoadout {
  id: string;
  hearts: number;
  weapon: string | null;
  shield: string | null;
  bag: string[];
}

function itemFrom(hexobjectKey: string | null) {
  const key = hexobjectKey ? battleItemOfHexobject(hexobjectKey) : null;
  return key ? battleItem(key) : null;
}

export function heroBattleCreature(loadout: HeroLoadout): BattleCreature {
  const def = BATTLE_CREATURES.hero;
  const hp = Math.max(1, Math.round(loadout.hearts * 2));
  return {
    id: loadout.id,
    side: 'heroes',
    kind: 'hero',
    pos: { q: 0, r: 0 },
    hp,
    maxHp: hp,
    weight: def.weight,
    force: def.force,
    hands: { right: itemFrom(loadout.weapon), left: itemFrom(loadout.shield) },
    bag: loadout.bag.map(itemFrom).filter((item) => item !== null),
  };
}

export interface EncounterBattlePlan {
  battleId: string;
  field: Battlefield;
  direction: Vector;
  deployment: Deployment;
}

export function planEncounterBattle(
  map: HexMapModel,
  engagement: Pick<Engagement, 'encounterId' | 'ambush' | 'heroAt'>,
  heroes: BattleCreature[],
): EncounterBattlePlan {
  const placed = findEncounter(map, engagement.encounterId);
  if (!placed) throw new Error(`Unknown encounter on this board: ${engagement.encounterId}`);
  const def = encounterDef(placed.encounter.contentId);
  const attempt = placed.encounter.attempts;
  const field = generateBattlefield(
    def.battlefieldBiome,
    battlefieldSeed(placed.encounter.id, attempt),
  );
  const direction = approachDirection(placed.tile.coordinates, engagement.heroAt);
  const battleId = `${placed.encounter.id}#${attempt}`;
  const deployment = deployBattle({
    battleId,
    field,
    heroes,
    members: def.members,
    direction,
    ambush: engagement.ambush,
  });
  return { battleId, field, direction, deployment };
}

function itemKeys(creature: BattleCreature): string[] {
  return [creature.hands.right, creature.hands.left, ...creature.bag]
    .filter((item) => item !== null)
    .map((item) => item.key);
}

export function startItemsOf(heroes: BattleCreature[]): Record<string, string[]> {
  return Object.fromEntries(heroes.map((hero) => [hero.id, itemKeys(hero)]));
}

function consumedItems(before: string[], after: string[]): string[] {
  const left = [...after];
  const consumed: string[] = [];
  for (const key of before) {
    const index = left.indexOf(key);
    if (index >= 0) left.splice(index, 1);
    else consumed.push(key);
  }
  return consumed
    .map((key) => hexobjectOfBattleItem(key))
    .filter((key): key is string => key !== null);
}

export interface HeroBattleSummary {
  id: string;
  hearts: number;
  consumed: string[];
}

export function heroSummaries(battle: BattleState, engagement: Engagement): HeroBattleSummary[] {
  return battle.creatures
    .filter((c) => c.side === 'heroes')
    .map((hero) => ({
      id: hero.id,
      hearts: hero.hp / 2,
      consumed: consumedItems(engagement.startItems[hero.id] ?? [], itemKeys(hero)),
    }));
}

export function enemiesIn(battle: BattleState): number {
  return battle.creatures.filter((c) => c.side === 'enemies').length;
}

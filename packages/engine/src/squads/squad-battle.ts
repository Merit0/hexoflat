import type { DomainEvent } from '../commands/types';
import type HexMapModel from '../map/models/hex-map-model';
import {
  BATTLE_CREATURES,
  battleItem,
  battleItemOfHexobject,
  hexobjectOfBattleItem,
} from '../battle/battle-catalogue';
import type { BattleCreature, BattleState } from '../battle/battle-state';
import { battlefieldSeed, generateBattlefield, type Battlefield } from '../battle/battlefield';
import {
  approachDirection,
  deployBattle,
  type Deployment,
  type Vector,
} from '../battle/battlefield-setup';
import { startBattle } from '../battle/start-battle';
import type { Engagement } from './engagement';
import { findSquad } from './squad-state';
import { done, refuse, type Outcome, type SquadWorld } from './squad-actions';

export interface HeroLoadout {
  id: string;
  hearts: number;
  maxHearts?: number;
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
  const maxHp = Math.max(hp, Math.round((loadout.maxHearts ?? loadout.hearts) * 2));
  return {
    id: loadout.id,
    side: 'heroes',
    kind: 'hero',
    pos: { q: 0, r: 0 },
    hp,
    maxHp,
    weight: def.weight,
    force: def.force,
    hands: { right: itemFrom(loadout.weapon), left: itemFrom(loadout.shield) },
    bag: loadout.bag.map(itemFrom).filter((item) => item !== null),
  };
}

export interface SquadBattlePlan {
  battleId: string;
  field: Battlefield;
  direction: Vector;
  deployment: Deployment;
}

export function planSquadBattle(
  map: HexMapModel,
  engagement: Pick<Engagement, 'squadId' | 'ambush' | 'heroAt'>,
  heroes: BattleCreature[],
): SquadBattlePlan {
  const placed = findSquad(map, engagement.squadId);
  if (!placed) throw new Error(`Unknown squad on this board: ${engagement.squadId}`);
  const { squad, tile } = placed;
  const def = squad.creature.squad;
  const attempt = squad.creature.attempts ?? 0;
  const field = generateBattlefield(def.battlefieldBiome, battlefieldSeed(squad.id, attempt));
  const direction = approachDirection(tile.coordinates, engagement.heroAt);
  const battleId = `${squad.id}#${attempt}`;
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

export function beginBattle(world: SquadWorld, heroes: BattleCreature[]): Outcome {
  const engagement = world.engagement;
  if (!engagement) return refuse('NO_ENGAGEMENT');
  if (world.battle) return refuse('BATTLE_OPEN');
  if (!findSquad(world.map, engagement.squadId)) return refuse('UNKNOWN_SQUAD');
  const plan = planSquadBattle(world.map, engagement, heroes);
  const setup = { ...plan.deployment.setup, taskHistory: world.knowledge?.history ?? {} };
  const result = startBattle(setup);
  world.battle = result.battle;
  engagement.startItems = startItemsOf(heroes);
  return done(result.events);
}

export function closeBattle(world: SquadWorld): Outcome {
  const { battle, engagement } = world;
  if (!engagement) return refuse('NO_ENGAGEMENT');
  if (!battle || !battle.outcome) return refuse('BATTLE_NOT_ENDED');
  const placed = findSquad(world.map, engagement.squadId);
  if (!placed) return refuse('UNKNOWN_SQUAD');
  const { squad, tile } = placed;
  const events: DomainEvent[] = [];
  const victory = battle.outcome === 'victory';
  if (victory) {
    tile.hexobject = null;
    events.push({ type: 'SQUAD_DEFEATED', payload: { squadId: squad.id } });
  } else {
    squad.creature.attempts = (squad.creature.attempts ?? 0) + 1;
  }
  events.push({
    type: 'BATTLE_CLOSED',
    payload: {
      squadId: squad.id,
      outcome: battle.outcome,
      heroAt: { ...engagement.heroAt },
      heroes: heroSummaries(battle, engagement),
      kills: victory ? enemiesIn(battle) : 0,
    },
  });
  world.battle = undefined;
  world.engagement = undefined;
  return done(events);
}

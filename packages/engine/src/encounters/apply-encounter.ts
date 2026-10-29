import type { DomainEvent } from '../commands/types';
import { startBattle } from '../battle/start-battle';
import type { BattleCreature } from '../battle/battle-state';
import { assertNever } from '../utils/assert-never';
import { encounterDef } from './encounter-content';
import { findEncounter } from './encounter-state';
import type { EncounterCommand } from './encounter-commands';
import {
  attackEncounter,
  pickupLoot,
  refuse,
  resolveSneak,
  scoutEncounter,
  startSneak,
  stepEnded,
  type EncounterWorld,
  type Outcome,
} from './encounter-actions';
import { enemiesIn, heroSummaries, planEncounterBattle, startItemsOf } from './encounter-battle';

function beginBattle(world: EncounterWorld, heroes: BattleCreature[]): Outcome {
  const engagement = world.engagement;
  if (!engagement) return refuse('NO_ENGAGEMENT');
  if (world.battle) return refuse('BATTLE_OPEN');
  if (!findEncounter(world.map, engagement.encounterId)) return refuse('UNKNOWN_ENCOUNTER');
  const plan = planEncounterBattle(world.map, engagement, heroes);
  const setup = { ...plan.deployment.setup, taskHistory: world.knowledge?.history ?? {} };
  const result = startBattle(setup);
  world.battle = result.battle;
  engagement.startItems = startItemsOf(heroes);
  return { ok: true, events: result.events };
}

function closeBattle(world: EncounterWorld): Outcome {
  const { battle, engagement } = world;
  if (!engagement) return refuse('NO_ENGAGEMENT');
  if (!battle || !battle.outcome) return refuse('BATTLE_NOT_ENDED');
  const placed = findEncounter(world.map, engagement.encounterId);
  if (!placed) return refuse('UNKNOWN_ENCOUNTER');
  const { encounter } = placed;
  const events: DomainEvent[] = [];
  const victory = battle.outcome === 'victory';
  if (victory) {
    encounter.status = 'loot';
    const items = [...encounterDef(encounter.contentId).loot];
    events.push(
      { type: 'ENCOUNTER_DEFEATED', payload: { encounterId: encounter.id } },
      { type: 'LOOT_DROPPED', payload: { encounterId: encounter.id, items } },
    );
  } else {
    encounter.attempts += 1;
  }
  events.push({
    type: 'BATTLE_CLOSED',
    payload: {
      encounterId: encounter.id,
      outcome: battle.outcome,
      heroAt: { ...engagement.heroAt },
      heroes: heroSummaries(battle, engagement),
      kills: victory ? enemiesIn(battle) : 0,
    },
  });
  world.battle = undefined;
  world.engagement = undefined;
  return { ok: true, events };
}

function perform(world: EncounterWorld, command: EncounterCommand): Outcome {
  const { heroId, atMs, action } = command.payload;
  switch (action.kind) {
    case 'attack':
      return attackEncounter(world, { heroId, atMs, encounterId: action.encounterId });
    case 'scout':
      return scoutEncounter(world, { heroId, atMs, encounterId: action.encounterId });
    case 'start-sneak':
      return startSneak(world, { heroId, atMs, encounterId: action.encounterId });
    case 'answer-sneak':
      return resolveSneak(world, { heroId, atMs, encounterId: action.encounterId }, action.option);
    case 'sneak-timeout':
      return resolveSneak(world, { heroId, atMs, encounterId: action.encounterId }, null);
    case 'pickup-loot':
      return pickupLoot(world, { heroId, atMs, encounterId: action.encounterId });
    case 'step-ended':
      return stepEnded(world, heroId);
    case 'start-battle':
      return beginBattle(world, action.heroes);
    case 'close-battle':
      return closeBattle(world);
    default:
      return assertNever(action);
  }
}

export function applyEncounterCommand(
  world: EncounterWorld,
  command: EncounterCommand,
): DomainEvent[] {
  const outcome = perform(world, command);
  if (outcome.ok) return outcome.events;
  return [
    {
      type: 'ENCOUNTER_REJECTED',
      payload: {
        heroId: command.payload.heroId,
        action: command.payload.action.kind,
        reason: outcome.reason,
      },
    },
  ];
}

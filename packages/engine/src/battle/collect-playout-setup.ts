import { locationTokenOrigin } from '../registry/location-token-origin';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { deriveStream } from '../utils/random-seeded';
import { applyBattleCommand } from './apply-battle';
import { BATTLE_RULES } from './battle-content';
import { battlefieldSeed, generateBattlefield } from './battlefield';
import { deployBattle } from './battlefield-setup';
import { heroBotAction } from './battle-sim';
import type { BattleState } from './battle-state';
import { hero, TEST_TOKEN_SECRET } from './battle-test-setup';
import { projectBattleForViewer } from './projection';
import { startBattle } from './start-battle';

const ON = { ...BATTLE_RULES, graveLootEnabled: true };
const MAX_COMMANDS = 2_000;
const MAX_ROUNDS = 30;

export function playOutSquad(members: string[], battleId: string, fieldLabel: string): BattleState {
  // Keep the benchmark's historical two-side loadout through real equipment stats.
  const player = hero({ q: 0, r: 0 });
  player.hands.left!.token = {
    ...upcastToken('hero', 'benchmark-shield', 'shield')!,
    attributes: [{ key: 'shield', value: 1 }],
  };
  const { setup } = deployBattle({
    battleId,
    field: generateBattlefield('crypt', battlefieldSeed(fieldLabel, 0)),
    heroes: [player],
    members,
    direction: { x: -1, y: 0 },
    ambush: false,
  });
  const rng = deriveStream(setup.seed, 'sim:answers');
  let battle = startBattle({ ...setup, tokenSecret: TEST_TOKEN_SECRET }, ON).battle;
  battle.tokenOrigin = locationTokenOrigin('cave');
  for (let i = 0, atMs = 0; i < MAX_COMMANDS && !battle.outcome; i++, atMs += 1_000) {
    if (battle.round > MAX_ROUNDS) break;
    const task = battle.task;
    const active = battle.creatures.find((c) => c.id === battle.activeId)!;
    const payload = task
      ? {
          kind: 'hero' as const,
          heroId: task.creatureId,
          atMs: task.issuedAtMs + 2_000,
          action: {
            kind: 'answer-task' as const,
            option: task.options.findIndex((o) =>
              rng() < 0.8 ? o === task.answer : o !== task.answer,
            ),
          },
        }
      : active.side === 'enemies'
        ? { kind: 'run-enemy-turn' as const, atMs }
        : {
            kind: 'hero' as const,
            heroId: active.id,
            atMs,
            action: heroBotAction(projectBattleForViewer(battle, 'heroes'), ON),
          };
    const result = applyBattleCommand(battle, { type: 'BATTLE', payload }, ON);
    const refused = result.events.some((e) => e.type === 'BATTLE_REJECTED');
    battle =
      refused && payload.kind === 'hero'
        ? applyBattleCommand(
            battle,
            { type: 'BATTLE', payload: { ...payload, action: { kind: 'end-turn' as const } } },
            ON,
          ).battle!
        : result.battle!;
  }
  return battle;
}

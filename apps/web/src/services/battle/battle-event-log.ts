import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { i18n } from '@/i18n';
import { useBattleStore } from '@/stores/battle-store';
import { useGameEventsStore } from '@/stores/game-events-store';

interface Resolved {
  creatureId: string;
  results: { attackerId: string; outcome: 'blocked' | 'hit' | 'dodged'; damage: number }[];
}

type NamedBattle = { creatures: { id: string; kind: string }[] };

function nameResolver(battle: NamedBattle | null) {
  const names = useBattleStore().deploy?.names ?? {};
  return (id: string): string => {
    if (names[id]) return names[id];
    const kind = battle?.creatures.find((creature) => creature.id === id)?.kind;
    return kind ? i18n.global.t(`content.battle.${kind}.title`) : id;
  };
}

export function logBattleEvents(events: DomainEvent[], battle: NamedBattle | null): void {
  const log = useGameEventsStore();
  const t = i18n.global.t;
  const nameOf = nameResolver(battle);
  const push = (actor: string, message: string) => log.push(actor, message, 'BATTLE');

  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    switch (event.type) {
      case 'BATTLE_STARTED':
        push(t('battle.log.actor'), t('battle.log.started'));
        break;
      case 'TURN_STARTED': {
        const name = nameOf(String(payload.creatureId));
        push(name, t('battle.log.turn'));
        break;
      }
      case 'REACTION_OPENED': {
        const attacker = nameOf(String(payload.attackerId));
        const target = nameOf(String(payload.defenderId));
        push(attacker, t('battle.log.picks', { target }));
        break;
      }
      case 'STRIKES_RESOLVED': {
        const resolved = payload as unknown as Resolved;
        const target = nameOf(resolved.creatureId);
        for (const result of resolved.results) {
          const attacker = nameOf(result.attackerId);
          const text =
            result.outcome === 'hit'
              ? t('battle.log.hit', { target, hearts: result.damage / 2 })
              : t('battle.log.blocked', { target });
          push(attacker, text);
        }
        break;
      }
      case 'STRIKE_SWEPT': {
        const attacker = nameOf(String(payload.attackerId));
        const target = nameOf(String(payload.victimId));
        push(attacker, t('battle.log.swept', { target, hearts: Number(payload.damage) / 2 }));
        break;
      }
      case 'CREATURE_FELL': {
        const name = nameOf(String(payload.creatureId));
        push(name, t('battle.log.fell'));
        break;
      }
      case 'BATTLE_ENDED':
        push(
          t('battle.log.actor'),
          payload.outcome === 'victory' ? t('battle.log.victory') : t('battle.log.defeat'),
        );
        break;
      default:
        break;
    }
  }
}

import { BATTLE_CREATURES, BATTLE_ITEMS } from '../battle/battle-catalogue';
import type { BattleItem } from '../battle/battle-state';
import { ENCOUNTER_RULES, type EncounterRules } from './encounter-content';

export const THREATS = ['easy', 'risky', 'deadly'] as const;
export type Threat = (typeof THREATS)[number];

export interface ThreatProfile {
  hearts: number;
  power: number;
  shield: number;
}

function itemPower(key: string | null | undefined): number {
  return key ? (BATTLE_ITEMS[key]?.power ?? 0) : 0;
}

export function memberProfile(kind: string): ThreatProfile {
  const def = BATTLE_CREATURES[kind];
  if (!def) throw new Error(`Unknown battle creature: ${kind}`);
  return {
    hearts: def.hp / 2,
    power: Math.max(itemPower(def.hands.right), itemPower(def.hands.left)),
    shield: 0,
  };
}

export function handsProfile(
  hearts: number,
  hands: { right: BattleItem | null; left: BattleItem | null },
  rules: EncounterRules = ENCOUNTER_RULES,
): ThreatProfile {
  const held = [hands.right, hands.left];
  const power = Math.max(0, ...held.map((item) => item?.power ?? 0));
  const shield = held.reduce((sum, item) => sum + (item?.shieldCapacity ?? 0), 0);
  return { hearts, power: power || rules.unarmedPower, shield };
}

export function squadStrength(members: readonly string[]): number {
  const profiles = members.map(memberProfile);
  const hearts = profiles.reduce((sum, p) => sum + p.hearts, 0);
  const power = profiles.reduce((sum, p) => sum + p.power, 0) / Math.max(1, profiles.length);
  return hearts * power;
}

export function heroStrength(hero: ThreatProfile): number {
  return hero.hearts * hero.power + hero.shield;
}

export function encounterThreat(
  members: readonly string[],
  hero: ThreatProfile,
  rules: EncounterRules = ENCOUNTER_RULES,
): Threat {
  const ratio = squadStrength(members) / Math.max(Number.EPSILON, heroStrength(hero));
  if (ratio <= rules.threat.easyMax) return 'easy';
  if (ratio <= rules.threat.riskyMax) return 'risky';
  return 'deadly';
}

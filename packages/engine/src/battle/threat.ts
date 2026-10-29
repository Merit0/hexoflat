import { z } from 'zod';
import { BATTLE_CREATURES, BATTLE_ITEMS } from './battle-catalogue';
import type { BattleItem } from './battle-state';

export const threatRulesSchema = z.object({
  easyMax: z.number().positive(),
  riskyMax: z.number().positive(),
  unarmedPower: z.number().int().positive(),
});
export type ThreatRules = z.infer<typeof threatRulesSchema>;

export const THREAT_RULES: ThreatRules = threatRulesSchema.parse({
  easyMax: 0.6,
  riskyMax: 1.3,
  unarmedPower: 1,
});

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
  rules: ThreatRules = THREAT_RULES,
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

export function squadThreat(
  members: readonly string[],
  hero: ThreatProfile,
  rules: ThreatRules = THREAT_RULES,
): Threat {
  const ratio = squadStrength(members) / Math.max(Number.EPSILON, heroStrength(hero));
  if (ratio <= rules.easyMax) return 'easy';
  if (ratio <= rules.riskyMax) return 'risky';
  return 'deadly';
}

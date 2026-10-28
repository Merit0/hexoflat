import { z } from 'zod';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { axialToPixelPointy, offsetToAxial } from '../utils/hex-utils';
import { enemyCreature } from '../battle/battle-catalogue';
import type {
  BattleCreature,
  BattleHex,
  BattleSetupInput,
  BattleSide,
} from '../battle/battle-state';
import type { Battlefield } from '../battle/battlefield';
import { battleDistance, hexKey, parseHexKey } from '../battle/hex-battle-geom';

export const deploymentRulesSchema = z.object({
  heroZoneMinRing: z.number().int().min(0),
  heroZoneCos: z.number().min(-1).max(1),
  enemyZoneMinRing: z.number().int().min(0),
  enemyZoneCos: z.number().min(-1).max(1),
  ambushRing: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  ambushCos: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]),
});
export type DeploymentRules = z.infer<typeof deploymentRulesSchema>;

export const DEPLOYMENT_RULES: DeploymentRules = deploymentRulesSchema.parse({
  heroZoneMinRing: 3,
  heroZoneCos: 0.6,
  enemyZoneMinRing: 2,
  enemyZoneCos: -0.5,
  ambushRing: [2, 3],
  ambushCos: [-0.1, 0.85],
});

export interface Vector {
  x: number;
  y: number;
}

const DEFAULT_APPROACH: Vector = { x: -1, y: 0 };
const CENTER: BattleHex = { q: 0, r: 0 };

export function approachDirection(encounter: IHexCoordinates, hero: IHexCoordinates): Vector {
  const from = axialToPixelPointy(offsetToAxial(encounter), 1);
  const to = axialToPixelPointy(offsetToAxial(hero), 1);
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : DEFAULT_APPROACH;
}

export function cosineTo(hex: BattleHex, direction: Vector): number {
  const p = axialToPixelPointy(hex, 1);
  const length = Math.hypot(p.x, p.y);
  return length ? (p.x * direction.x + p.y * direction.y) / length : 0;
}

export interface DeploymentZones {
  heroes: BattleHex[];
  enemies: BattleHex[];
}

function placeable(field: Battlefield, hex: BattleHex): boolean {
  const terrain = field.board[hexKey(hex)];
  if (!terrain || terrain === 'wall' || terrain === 'saw') return false;
  return !field.boulders.some((b) => b.pos.q === hex.q && b.pos.r === hex.r);
}

export function deploymentZones(
  field: Battlefield,
  direction: Vector,
  ambush: boolean,
  rules: DeploymentRules = DEPLOYMENT_RULES,
): DeploymentZones {
  const hexes = Object.keys(field.board)
    .map(parseHexKey)
    .filter((hex) => placeable(field, hex));
  const ring = (hex: BattleHex) => battleDistance(hex, CENTER);
  const cos = (hex: BattleHex) => cosineTo(hex, direction);
  const heroes = hexes.filter(
    (h) => ring(h) >= rules.heroZoneMinRing && cos(h) > rules.heroZoneCos,
  );
  const inHeroZone = new Set(heroes.map(hexKey));
  const enemies = ambush
    ? hexes.filter(
        (h) =>
          !inHeroZone.has(hexKey(h)) &&
          ring(h) >= rules.ambushRing[0] &&
          ring(h) <= rules.ambushRing[1] &&
          cos(h) >= rules.ambushCos[0] &&
          cos(h) <= rules.ambushCos[1],
      )
    : hexes.filter((h) => ring(h) >= rules.enemyZoneMinRing && cos(h) < rules.enemyZoneCos);
  return { heroes, enemies };
}

function farthestFirst(hexes: BattleHex[], direction: Vector, toward: 1 | -1): BattleHex[] {
  return [...hexes].sort(
    (a, b) =>
      battleDistance(b, CENTER) - battleDistance(a, CENTER) ||
      toward * (cosineTo(b, direction) - cosineTo(a, direction)) ||
      hexKey(a).localeCompare(hexKey(b)),
  );
}

function nearestTo(hexes: BattleHex[], anchors: BattleHex[]): BattleHex[] {
  const reach = (hex: BattleHex) => Math.min(...anchors.map((a) => battleDistance(a, hex)));
  return [...hexes].sort((a, b) => reach(a) - reach(b) || hexKey(a).localeCompare(hexKey(b)));
}

export interface DeploymentInput {
  battleId: string;
  field: Battlefield;
  heroes: BattleCreature[];
  members: string[];
  direction: Vector;
  ambush: boolean;
  rules?: DeploymentRules;
}

export interface Deployment {
  setup: BattleSetupInput;
  zones: DeploymentZones;
}

export function deployBattle(input: DeploymentInput): Deployment {
  const { field, direction, ambush } = input;
  const zones = deploymentZones(field, direction, ambush, input.rules);
  const heroSpots = farthestFirst(zones.heroes, direction, 1);
  const heroes = input.heroes.map((hero, i) => ({ ...hero, pos: heroSpots[i] }));
  const taken = new Set(heroes.map((h) => hexKey(h.pos)));
  const enemyOrder = ambush
    ? nearestTo(
        zones.enemies,
        heroes.map((h) => h.pos),
      )
    : farthestFirst(zones.enemies, direction, -1);
  const free = enemyOrder.filter((hex) => !taken.has(hexKey(hex)));
  if (heroSpots.length < heroes.length || free.length < input.members.length) {
    throw new Error(`battlefield ${field.seed}: deployment zone too small`);
  }
  const enemies = input.members.map((kind, i) => enemyCreature(kind, `${kind}-${i + 1}`, free[i]));
  const advantage: BattleSide = ambush ? 'enemies' : 'heroes';
  return {
    zones,
    setup: {
      id: input.battleId,
      seed: field.seed,
      board: field.board,
      boulders: field.boulders,
      creatures: [...heroes, ...enemies],
      advantage,
    },
  };
}

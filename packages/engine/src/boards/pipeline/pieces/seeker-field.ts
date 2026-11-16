import { z } from 'zod';
import { deriveStream } from '../../../utils/random-seeded';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
} from '../../../utils/hex-utils';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import type { Piece } from '../types';

const Shape = z.object({
  kind: z.literal('seeker-field'),
  center: z.object({ q: z.number().int(), r: z.number().int() }),
  radius: z.number().int().min(2).max(12),
  edgeGapChance: z.number().min(0).max(1),
});

export const formSeekerField: Piece<z.infer<typeof Shape>> = {
  id: 'seeker-field',
  schema: Shape,
  tableRule:
    'Lay a numbered-trail field with a broken outer edge and choose one remaining edge hex as the hero start.',
  run(draft, params, ctx) {
    const random = deriveStream(ctx.sourceSeed ?? ctx.seed, 'quest:field');
    const center = axialToOffset(params.center);
    const cells = [];
    for (let dq = -params.radius; dq <= params.radius; dq += 1) {
      const from = Math.max(-params.radius, -dq - params.radius);
      const to = Math.min(params.radius, -dq + params.radius);
      for (let dr = from; dr <= to; dr += 1)
        cells.push(axialToOffset({ q: params.center.q + dq, r: params.center.r + dr }));
    }
    const floor = cells.filter(
      (hex) => hexDistance(center, hex) < params.radius || random() >= params.edgeGapChance,
    );
    const edge = floor
      .filter((hex) => hexDistance(center, hex) === params.radius)
      .sort((a, b) => coordinateKey(a).localeCompare(coordinateKey(b)));
    const start = edge[Math.floor(random() * edge.length)];
    for (const hex of floor) draft.cellMap.set(hex, { exists: true, regionId: 'field' });
    draft.regions.push({ id: 'field', role: 'field', cells: floor });
    draft.regions.push({ id: 'start', role: 'hero-start', cells: [start] });
  },
};

const Border = Shape.omit({ edgeGapChance: true }).extend({ kind: z.literal('seeker-border') });
export const boundsSeekerBorder: Piece<z.infer<typeof Border>> = {
  id: 'seeker-border',
  schema: Border,
  tableRule: 'Enclose the numbered field with a visible ring of trees and rocks.',
  run(draft, params) {
    const center = axialToOffset(params.center);
    let index = 0;
    for (let dq = -params.radius; dq <= params.radius; dq += 1) {
      for (
        let dr = Math.max(-params.radius, -dq - params.radius);
        dr <= Math.min(params.radius, -dq + params.radius);
        dr += 1
      ) {
        const hex = axialToOffset({ q: params.center.q + dq, r: params.center.r + dr });
        if (hexDistance(center, hex) !== params.radius) continue;
        draft.cellMap.set(hex, {
          exists: true,
          regionId: 'border',
          hexobject: {
            hexobjectKey: index++ % 3 === 0 ? HEXOBJECT_KEYS.TREE : HEXOBJECT_KEYS.ROCK,
          },
        });
      }
    }
  },
};

const Gate = z.object({ kind: z.literal('seeker-camp') });
export const gatesSeekerCamp: Piece<z.infer<typeof Gate>> = {
  id: 'seeker-camp',
  schema: Gate,
  tableRule: 'Replace one border tree or rock beside the hero start with the camping door.',
  run(draft) {
    const start = draft.regions.find((region) => region.role === 'hero-start')?.cells[0];
    if (!start) throw new Error('Seeker camping door requires a hero start');
    const door = getHexNeighbors(start).find(
      (hex) => draft.cellMap.get(hex)?.regionId === 'border',
    );
    if (!door) throw new Error('Seeker start requires an adjacent border cell');
    draft.cellMap.set(door, {
      exists: true,
      regionId: 'border',
      hexobject: {
        hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      },
    });
    draft.regions.push({ id: 'exit', role: 'exit', cells: [door] });
  },
};

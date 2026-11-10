import { z } from 'zod';
import { EHexActionType } from '../enums/hex-action-type';
import { LOCATION_KEYS } from '../registry/location-key';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { battleActionSchema } from '../battle/battle-commands';

const coordinates = z.object({
  columnIndex: z.number().int().min(0).max(255),
  rowIndex: z.number().int().min(0).max(255),
});
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));
const clientHint = z
  .object({
    tool: z
      .object({
        dragging: z.boolean(),
        hover: coordinates.strict().nullable(),
        active: z
          .string()
          .refine((key) => KNOWN_KEYS.has(key), 'unknown tool')
          .nullable(),
        durability: z
          .object({ current: z.number().min(0).max(100000), max: z.number().min(0).max(100000) })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();
const base = { heroId: z.string().min(1) };

export const WORLD_COMMAND_SCHEMAS = {
  WORLD_ENTER: z
    .object({
      type: z.literal('WORLD_ENTER'),
      payload: z.object({ ...base, locationKey: z.enum(LOCATION_KEYS) }).strict(),
    })
    .strict(),
  WORLD_STEP: z
    .object({
      type: z.literal('WORLD_STEP'),
      payload: z.object({ ...base, target: coordinates.strict() }).strict(),
    })
    .strict(),
  WORLD_ACTION: z
    .object({
      type: z.literal('WORLD_ACTION'),
      payload: z
        .object({
          ...base,
          coordinates: coordinates.strict(),
          actionType: z.enum(EHexActionType),
          toolKey: z.string().refine((key) => KNOWN_KEYS.has(key), 'unknown tool'),
          client: clientHint.optional(),
        })
        .strict(),
    })
    .strict(),
  WORLD_TRAVEL: z
    .object({
      type: z.literal('WORLD_TRAVEL'),
      payload: z
        .object({
          ...base,
          via: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('exit') }).strict(),
            z.object({ kind: z.literal('gate'), coordinates: coordinates.strict() }).strict(),
          ]),
        })
        .strict(),
    })
    .strict(),
  WORLD_PORTAL_OPEN: z
    .object({
      type: z.literal('WORLD_PORTAL_OPEN'),
      payload: z.object({ ...base, target: coordinates.strict() }).strict(),
    })
    .strict(),
  WORLD_PORTAL_ENTER: z
    .object({ type: z.literal('WORLD_PORTAL_ENTER'), payload: z.object(base).strict() })
    .strict(),
  WORLD_PORTAL_CLOSE: z
    .object({ type: z.literal('WORLD_PORTAL_CLOSE'), payload: z.object(base).strict() })
    .strict(),
  WORLD_BATTLE: z
    .object({
      type: z.literal('WORLD_BATTLE'),
      payload: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('start'), ...base }).strict(),
        z.object({ kind: z.literal('hero'), ...base, action: battleActionSchema }).strict(),
        z.object({ kind: z.literal('run-enemy-turn'), ...base }).strict(),
        z.object({ kind: z.literal('close'), ...base }).strict(),
        z.object({ kind: z.literal('sync'), ...base }).strict(),
      ]),
    })
    .strict(),
  WORLD_TICK: z
    .object({
      type: z.literal('WORLD_TICK'),
      payload: z.object({ ...base, client: clientHint.optional() }).strict(),
    })
    .strict(),
} as const;

export type TWorldCommandType = keyof typeof WORLD_COMMAND_SCHEMAS;
export type WorldPlayerCommand = z.infer<(typeof WORLD_COMMAND_SCHEMAS)[TWorldCommandType]>;

export function isWorldCommandType(type: string): type is TWorldCommandType {
  return Object.hasOwn(WORLD_COMMAND_SCHEMAS, type);
}

import { z } from 'zod';
import { EHexActionType } from '../enums/hex-action-type';
import { LOCATION_KEYS } from '../registry/location-key';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

const coordinates = z.object({
  columnIndex: z.number().int().min(0).max(255),
  rowIndex: z.number().int().min(0).max(255),
});
const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));
const base = { heroId: z.string().min(1) };

/** Commands on the world the server holds (D4b). Every payload is strict: nothing the player adds is read. */
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
        })
        .strict(),
    })
    .strict(),
  WORLD_TICK: z
    .object({ type: z.literal('WORLD_TICK'), payload: z.object(base).strict() })
    .strict(),
} as const;

export type TWorldCommandType = keyof typeof WORLD_COMMAND_SCHEMAS;
export type WorldPlayerCommand = z.infer<(typeof WORLD_COMMAND_SCHEMAS)[TWorldCommandType]>;

export function isWorldCommandType(type: string): type is TWorldCommandType {
  return Object.hasOwn(WORLD_COMMAND_SCHEMAS, type);
}

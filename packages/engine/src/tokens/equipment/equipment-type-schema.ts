import { z } from 'zod';
import { itemTypeDefinitionSchema } from '../token-content-schema';
import {
  equipmentSlotSchema,
  equipmentTypeFieldShape,
  type TEquipmentSlot,
  type TItemGroup,
} from './equipment-keys';

export const GROUP_SLOTS: Readonly<Record<TItemGroup, readonly TEquipmentSlot[]>> = {
  weapon: ['weapon', 'any'],
  defense: ['shield'],
  clothing: ['helm', 'armor', 'gloves', 'boots'],
  jewelry: ['ring', 'amulet'],
  burden: [],
  charm: [],
};

export const equipmentTypeDefinitionSchema = itemTypeDefinitionSchema
  .extend({
    slot: equipmentSlotSchema,
    strike: z.number().int().positive().optional(),
    ...equipmentTypeFieldShape,
  })
  .superRefine((type, ctx) => {
    if (!GROUP_SLOTS[type.group].includes(type.slot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['slot'],
        message: `slot ${type.slot} does not belong to group ${type.group}`,
      });
    }
    if (type.slot === 'any' && type.tool === null) {
      ctx.addIssue({ code: 'custom', path: ['slot'], message: 'only a tool fits any hand' });
    }
    if (type.enabled && type.strike === undefined) {
      ctx.addIssue({ code: 'custom', path: ['strike'], message: 'an enabled type needs a strike' });
    }
  });
export type EquipmentTypeDefinition = z.infer<typeof equipmentTypeDefinitionSchema>;

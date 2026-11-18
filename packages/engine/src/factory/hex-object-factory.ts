import { coordinateKey } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import {
  EHexobjectGroup,
  type THexobject,
  type THexobjectPrototype,
} from '../abstraction/hexobject-abstraction';
import { containerStateSchema } from '../containers/container';
import { getPrototype } from '../content';
import { itemTokenSchema } from '../tokens/token-schema';
import { THexobjectKey } from '../registry/hexobjects-registry';

function isPieceCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

export class HexObjectFactory {
  static create(
    key: THexobjectKey,
    coord: IHexCoordinates,
    overrides?: Record<string, unknown>,
  ): THexobject {
    const proto: THexobjectPrototype = getPrototype(key);
    const base: THexobjectPrototype = structuredClone(proto);
    const id = `${coordinateKey(coord)}:${key}`;
    const built: THexobject = { ...base, id };

    if (overrides) {
      this.applyOverrides(built, overrides);
    }

    return built;
  }

  private static applyOverrides(obj: THexobject, overrides: Record<string, unknown>) {
    if (isPieceCount(overrides.quantity)) obj.quantity = overrides.quantity;
    const container = containerStateSchema.safeParse(overrides.container);
    if (container.success) obj.container = container.data;
    const token = itemTokenSchema.safeParse(overrides.token);
    if (token.success && token.data.type === obj.hexobjectKey) obj.token = token.data;

    if (obj.groupType === EHexobjectGroup.RESOURCE) {
      if (typeof overrides.regrowMs === 'number') obj.resource.regrowMs = overrides.regrowMs;
      if (typeof overrides.amount === 'number') obj.resource.amount = overrides.amount;
      if (typeof overrides.isAvailable === 'boolean')
        obj.resource.isAvailable = overrides.isAvailable;
      if (typeof overrides.regrowAt === 'number' || overrides.regrowAt === null)
        obj.resource.regrowAt = overrides.regrowAt;
    }

    if (obj.groupType === EHexobjectGroup.TOOL) {
      if (typeof overrides.durability === 'number') obj.tool.durability = overrides.durability;
      if (typeof overrides.durabilityMax === 'number')
        obj.tool.durabilityMax = overrides.durabilityMax;
    }
  }
}

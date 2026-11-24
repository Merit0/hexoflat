import type { TypeRegistry } from '../registries';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { ItemTypeKey, TBaseTokenType } from '../token-keys';
import { refuseToken, type ITypePicker, type TokenResult } from './token-generation';

export class BaseTypePicker implements ITypePicker {
  constructor(private readonly types: TypeRegistry) {}

  pick(tokenType: TBaseTokenType, key: ItemTypeKey): TokenResult<ItemTypeDefinition> {
    if (!this.types.has(key)) return refuseToken('UNKNOWN_TYPE', `unknown item type "${key}"`);
    const type = this.types.get(key);
    if (!type.tokenTypes.includes(tokenType)) {
      return refuseToken('TYPE_NOT_IN_REALM', `item type "${key}" is not allowed in ${tokenType}`);
    }
    return { ok: true, value: type };
  }
}

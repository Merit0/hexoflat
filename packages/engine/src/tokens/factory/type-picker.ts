import { pickRandom, type RandomNumberGenerator } from '../../utils/random';
import type { TypeRegistry } from '../registries';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { ItemTypeKey, TBaseRealm } from '../token-keys';
import { refuseToken, type ITypePicker, type TokenResult } from './token-generation';

export class RealmTypePicker implements ITypePicker {
  constructor(private readonly types: TypeRegistry) {}

  pick(
    realm: TBaseRealm,
    requested: ItemTypeKey | undefined,
    rng: RandomNumberGenerator,
  ): TokenResult<ItemTypeDefinition> {
    if (requested !== undefined) return this.requested(realm, requested);
    const picked = pickRandom([...this.types.forRealm(realm)], rng);
    if (!picked) return refuseToken('NO_TYPE_IN_REALM', `no item type is allowed in ${realm}`);
    return { ok: true, value: picked };
  }

  private requested(realm: TBaseRealm, key: ItemTypeKey): TokenResult<ItemTypeDefinition> {
    if (!this.types.has(key)) return refuseToken('UNKNOWN_TYPE', `unknown item type "${key}"`);
    const type = this.types.get(key);
    if (!type.realms.includes(realm)) {
      return refuseToken('TYPE_NOT_IN_REALM', `item type "${key}" is not allowed in ${realm}`);
    }
    return { ok: true, value: type };
  }
}

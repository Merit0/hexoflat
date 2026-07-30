import { Injectable, NotFoundException } from '@nestjs/common';
import { CONTENT_VERSION, getMeta, getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';

const KNOWN_KEYS = new Set<string>(Object.values(HEXOBJECT_KEYS));

function isHexobjectKey(key: string): key is THexobjectKey {
  return KNOWN_KEYS.has(key);
}

@Injectable()
export class ContentService {
  listKeys() {
    return { version: CONTENT_VERSION, keys: Object.values(HEXOBJECT_KEYS) };
  }

  getByKey(key: string) {
    if (!isHexobjectKey(key)) {
      throw new NotFoundException(`Unknown Hexobject key: [ ${key} ]`);
    }
    return { prototype: getPrototype(key), meta: getMeta(key) };
  }
}

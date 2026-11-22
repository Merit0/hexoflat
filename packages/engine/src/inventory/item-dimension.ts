import type { EDimension } from '../dimensions/dimensions';
import { CONTENT } from '../content/content-map';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { ItemToken } from '../tokens/token-schema';

/** A token is a concrete dimensional variant; a tokenless item is catalogue-owned. */
export function itemDimensionOf(item: { key: THexobjectKey; token?: ItemToken }): EDimension {
  return item.token?.dimension ?? CONTENT[item.key].dimension;
}

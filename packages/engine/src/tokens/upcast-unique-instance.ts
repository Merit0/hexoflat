import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { seededRandomStreams } from './equipment/generator/attribute-streams';
import type { UniqueTokenContent } from './unique-schema';
import { rollAuthoredAttributes, uniqueInstanceId } from './unique-instance';
import { upcastTokensIn } from './upcast-tokens-in';

interface StoredAttribute {
  key: string;
  value: number;
}

function isAttribute(value: unknown): value is StoredAttribute {
  return !!value && typeof value === 'object' && 'key' in value && 'value' in value;
}

function instanceSeed(tokenId: string): string {
  return `unique-upcast/${tokenId}`;
}

/** Old-save reader: a unique stored before DA4b gets its instance id and its authored layer once. */
export function upcastUniqueInstance(
  raw: unknown,
  templates: readonly UniqueTokenContent[] = TOKEN_UNIQUES,
): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const token = raw as Record<string, unknown>;
  if (token.tier !== 'unique' || token.instanceId !== undefined) return raw;
  if (typeof token.id !== 'string' || !Array.isArray(token.attributes)) return raw;
  if (!token.attributes.every(isAttribute)) return raw;
  const seed = instanceSeed(token.id);
  const template = templates.find((entry) => entry.key === token.uniqueKey);
  const authored = rollAuthoredAttributes(
    template?.authoredAttributes ?? [],
    token.id,
    seededRandomStreams(seed),
  );
  const authoredKeys = new Set(authored.map((attribute) => attribute.key));
  const kept = token.attributes.filter((attribute) => !authoredKeys.has(attribute.key));
  return {
    ...token,
    instanceId: uniqueInstanceId(seed, token.id),
    attributes: [...kept, ...authored],
  };
}

export function upcastUniqueInstances(raw: unknown): unknown {
  return upcastTokensIn(raw, (token) => upcastUniqueInstance(token));
}

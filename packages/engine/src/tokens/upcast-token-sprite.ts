import { isOwnSpriteKey, spriteKeySchema } from './token-keys';

function isToken(value: Record<string, unknown>): boolean {
  return (
    (value.tier === 'base' || value.tier === 'unique') &&
    ['tokenType', 'mapTier', 'generatorVersion'].every((key) => key in value)
  );
}

export function upcastTokenSprite(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const token = raw as Record<string, unknown>;
  const stored = spriteKeySchema.safeParse(token.sprite);
  if (!stored.success) return raw;
  if (token.tier === 'unique') {
    return Object.fromEntries(Object.entries(token).filter(([key]) => key !== 'sprite'));
  }
  if (isOwnSpriteKey(String(token.tokenType), String(token.type), stored.data)) return raw;
  return { ...token, sprite: null };
}

export function upcastTokenSprites(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(upcastTokenSprites);
  if (!raw || typeof raw !== 'object') return raw;
  const walked = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, upcastTokenSprites(value)]),
  );
  return isToken(walked) ? upcastTokenSprite(walked) : walked;
}

import { isOwnSpriteKey, spriteKeySchema } from './token-keys';
import { upcastTokensIn } from './upcast-tokens-in';

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
  return upcastTokensIn(raw, upcastTokenSprite);
}

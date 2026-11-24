function isToken(value: Record<string, unknown>): boolean {
  return (
    (value.tier === 'base' || value.tier === 'unique') &&
    ['tokenType', 'mapTier', 'generatorVersion'].every((key) => key in value)
  );
}

export function upcastTokensIn(raw: unknown, upcast: (token: unknown) => unknown): unknown {
  if (Array.isArray(raw)) return raw.map((entry) => upcastTokensIn(entry, upcast));
  if (!raw || typeof raw !== 'object') return raw;
  const walked = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, upcastTokensIn(value, upcast)]),
  );
  return isToken(walked) ? upcast(walked) : walked;
}

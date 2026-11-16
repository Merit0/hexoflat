export const HERO_STORE_BLOB = 'hero-store';

const NAV_FIELDS = ['locationKey', 'locationMapId', 'returnStack'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function restorableHeroState(saved: unknown): Record<string, unknown> | null {
  if (!isRecord(saved)) return null;
  if (!isRecord(saved.nav)) return saved;
  const source = saved.nav;
  const nav = Object.fromEntries(
    NAV_FIELDS.filter((key) => key in source).map((key) => [key, source[key]]),
  );
  return { ...saved, nav };
}

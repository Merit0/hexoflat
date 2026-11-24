import { describe, expect, it } from 'vitest';
import { HeroModel } from '../models/hero-model';
import { EDimension } from './dimensions';
import { DEFAULT_HERO_ORIGIN, heroOriginRefusal, heroOriginSchema } from './hero-origin';

const DIMENSIONS_LIST = Object.values(EDimension);

describe('DA6: hero origin', () => {
  it('is Nowhere by default, also on a blank hero model', () => {
    expect(DEFAULT_HERO_ORIGIN).toBe(EDimension.NOWHERE);
    expect(new HeroModel().origin).toBe(EDimension.NOWHERE);
  });

  it.each(DIMENSIONS_LIST)('%s is a valid origin and may be repeated by a write', (origin) => {
    expect(heroOriginSchema.parse(origin)).toBe(origin);
    expect(heroOriginRefusal(origin, origin)).toBeNull();
    expect(heroOriginRefusal(origin, undefined)).toBeNull();
  });

  it.each(
    DIMENSIONS_LIST.flatMap((stored) =>
      DIMENSIONS_LIST.filter((next) => next !== stored).map((next) => [stored, next] as const),
    ),
  )('refuses a change from %s to %s', (stored, next) => {
    expect(heroOriginRefusal(stored, next)).toBe('HERO_ORIGIN_IMMUTABLE');
  });

  it.each(['gloom', 'NOWHERE', '', null, 4])('the schema refuses %j', (value) => {
    expect(heroOriginSchema.safeParse(value).success).toBe(false);
  });
});

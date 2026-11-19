import { itemTokenSchema, type ItemToken } from './token-schema';

export const LEGACY_SWORD: ItemToken = itemTokenSchema.parse({
  id: 'test:legacy:11',
  origin: 'base',
  type: 'sword',
  rarity: 'gloom',
  name: {
    kind: 'generated',
    prefix: 'content.tokens.prefix.bitter',
    noun: 'sword',
    suffix: 'content.tokens.suffix.weaver',
  },
  description: [
    {
      key: 'content.tokens.line.kind',
      params: {
        type: 'content.tokens.noun.sword',
        realm: 'content.tokens.realm.gloom',
      },
    },
    {
      key: 'content.tokens.line.strike',
      params: {
        strike: 1,
      },
    },
    {
      key: 'content.tokens.attr.heart',
      params: {
        value: 1,
      },
    },
    {
      key: 'content.tokens.line.tier',
      params: {
        tier: 3,
      },
    },
  ],
  attributes: [
    {
      key: 'heart',
      value: 2,
    },
  ],
  skills: [],
  price: 239,
  sprite: 'idol-sword-01',
  mapTier: 3,
  generatorVersion: 3,
  ext: {
    aspects: [],
    heroGrade: null,
  },
});

export const LEGACY_SHIELD: ItemToken = itemTokenSchema.parse({
  id: 'test:legacy:2',
  origin: 'base',
  type: 'shield',
  rarity: 'gloom',
  name: {
    kind: 'generated',
    noun: 'shield',
    suffix: 'content.tokens.suffix.stone-bridge',
  },
  description: [
    {
      key: 'content.tokens.line.kind',
      params: {
        type: 'content.tokens.noun.shield',
        realm: 'content.tokens.realm.gloom',
      },
    },
    {
      key: 'content.tokens.line.strike',
      params: {
        strike: 0.5,
      },
    },
    {
      key: 'content.tokens.attr.heart',
      params: {
        value: 1,
      },
    },
    {
      key: 'content.tokens.line.tier',
      params: {
        tier: 3,
      },
    },
  ],
  attributes: [
    {
      key: 'heart',
      value: 2,
    },
  ],
  skills: [],
  price: 241,
  sprite: 'idol-shield-01',
  mapTier: 3,
  generatorVersion: 3,
  ext: {
    aspects: [],
    heroGrade: null,
  },
});

export const LEGACY_UNIQUE: ItemToken = itemTokenSchema.parse({
  id: 'test:legacy:99',
  origin: 'unique',
  uniqueKey: 'lantern-eater',
  type: 'sword',
  rarity: 'gloom',
  name: {
    kind: 'authored',
    nameKey: 'content.tokens.unique.lantern-eater.name',
  },
  description: [
    {
      key: 'content.tokens.unique.lantern-eater.desc',
      params: {},
    },
    {
      key: 'content.tokens.line.kind',
      params: {
        type: 'content.tokens.noun.sword',
        realm: 'content.tokens.realm.gloom',
      },
    },
    {
      key: 'content.tokens.line.strike',
      params: {
        strike: 1,
      },
    },
    {
      key: 'content.tokens.attr.heart',
      params: {
        value: 0.5,
      },
    },
    {
      key: 'content.tokens.line.tier',
      params: {
        tier: 3,
      },
    },
  ],
  attributes: [
    {
      key: 'heart',
      value: 1,
    },
  ],
  skills: [],
  price: 900,
  sprite: '_placeholder',
  mapTier: 3,
  generatorVersion: 3,
  ext: {
    aspects: [],
    heroGrade: null,
  },
});

export const LEGACY_TOKENS: readonly ItemToken[] = [LEGACY_SWORD, LEGACY_SHIELD, LEGACY_UNIQUE];

import { ETokenType } from '../abstraction/hexobject-abstraction';
import type { TokenWord, WordPoolData } from '../tokens/token-content-schema';
import { wordKeyOf, type TBaseTokenType } from '../tokens/token-keys';

const SHARED_PREFIXES = [
  'ash',
  'rust',
  'frost',
  'ember',
  'thorn',
  'moss',
  'salt',
  'iron',
  'bone',
  'dusk',
  'dawn',
  'storm',
  'river',
  'stone',
  'oak',
  'reed',
  'smoke',
  'copper',
  'wolf',
  'crow',
  'hollow',
  'silence',
  'bitter',
  'lantern',
  'wind',
  'ridge',
  'marsh',
  'cinder',
  'amber',
  'hearth',
  'tide',
  'vow',
  'thistle',
  'pine',
  'flint',
  'willow',
  'birch',
  'heather',
  'tar',
  'owl',
  'hawk',
  'boar',
  'lichen',
  'slate',
  'ochre',
  'linen',
  'rain',
  'hail',
];

const SHARED_SUFFIXES = [
  'warden',
  'wanderer',
  'miller',
  'ferryman',
  'smith',
  'shepherd',
  'beekeeper',
  'hunter',
  'widow',
  'orphan',
  'herald',
  'tinker',
  'hermit',
  'pilgrim',
  'fisher',
  'scribe',
  'mason',
  'drover',
  'oath',
  'harvest',
  'crossing',
  'long-night',
  'first-snow',
  'last-light',
  'quiet-ford',
  'broken-bell',
  'salt-road',
  'old-well',
  'watchtower',
  'seventh-gate',
  'lost-herd',
  'red-hill',
  'cooper',
  'weaver',
  'tanner',
  'potter',
  'lamplighter',
  'bellringer',
  'stranger',
  'gravedigger',
  'falconer',
  'ninth-winter',
  'dry-spring',
  'stone-bridge',
  'burnt-mill',
  'thin-ice',
  'still-water',
  'long-rain',
];

const TOKEN_TYPE_PREFIXES: Record<TBaseTokenType, string[]> = {
  [ETokenType.GLOOM]: ['deep', 'lightless'],
  [ETokenType.IDOL]: ['clay', 'gilded'],
  [ETokenType.SPARK]: ['star', 'cloud'],
};

const TOKEN_TYPE_SUFFIXES: Record<TBaseTokenType, string[]> = {
  [ETokenType.GLOOM]: ['deep-root', 'sunken-hall'],
  [ETokenType.IDOL]: ['clay-idol', 'painted-mask'],
  [ETokenType.SPARK]: ['high-wind', 'morning-star'],
};

const WORD_THEMES: Record<string, string> = {
  star: 'star',
  'morning-star': 'star',
  deep: 'deep',
  'deep-root': 'deep',
  clay: 'clay',
  'clay-idol': 'clay',
  salt: 'salt',
  'salt-road': 'salt',
  wind: 'wind',
  'high-wind': 'wind',
  dusk: 'night',
  'long-night': 'night',
  lightless: 'light',
  lantern: 'light',
  'last-light': 'light',
  frost: 'snow',
  'first-snow': 'snow',
  river: 'river',
  'quiet-ford': 'river',
  'still-water': 'river',
  lamplighter: 'light',
  'ninth-winter': 'snow',
  'thin-ice': 'snow',
  hail: 'snow',
  stone: 'stone',
  'stone-bridge': 'stone',
  rain: 'rain',
  'long-rain': 'rain',
  hawk: 'hawk',
  falconer: 'hawk',
};

function word(slot: 'prefix' | 'suffix', id: string, tokenTypes?: TBaseTokenType[]): TokenWord {
  const theme = WORD_THEMES[id];
  return {
    key: wordKeyOf(slot, id),
    ...(tokenTypes ? { tokenTypes } : {}),
    ...(theme ? { theme } : {}),
  };
}

function words(
  slot: 'prefix' | 'suffix',
  shared: readonly string[],
  byTokenType: Record<TBaseTokenType, string[]>,
): TokenWord[] {
  const tagged = (Object.entries(byTokenType) as [TBaseTokenType, string[]][]).flatMap(
    ([tokenType, ids]) => ids.map((id) => word(slot, id, [tokenType])),
  );
  return [...shared.map((id) => word(slot, id)), ...tagged];
}

export const TOKEN_WORDS: WordPoolData = {
  prefixes: words('prefix', SHARED_PREFIXES, TOKEN_TYPE_PREFIXES),
  suffixes: words('suffix', SHARED_SUFFIXES, TOKEN_TYPE_SUFFIXES),
};

export const TOKEN_NAME_TEMPLATE_KEY = 'content.tokens.nameTemplate';

export const TOKEN_NAME_TEMPLATE_KEYS = {
  full: TOKEN_NAME_TEMPLATE_KEY,
  prefix: 'content.tokens.nameTemplatePrefix',
  suffix: 'content.tokens.nameTemplateSuffix',
} as const;

export type TokenNameShape = keyof typeof TOKEN_NAME_TEMPLATE_KEYS;

export const TOKEN_ADJECTIVE_NAME_TEMPLATE_KEY = 'content.tokens.nameTemplateAdjective';

export const TOKEN_NAME_RULES = {
  maxWords: 3,
  maxWordLetters: 10,
  shortWordLetters: 7,
  minShortWordShare: 0.9,
} as const;

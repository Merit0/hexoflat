import { ERarityKind } from '../abstraction/hexobject-abstraction';
import type { TokenWord, WordPoolData } from '../tokens/token-content-schema';
import { wordKeyOf, type TBaseRealm } from '../tokens/token-keys';

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

const REALM_PREFIXES: Record<TBaseRealm, string[]> = {
  [ERarityKind.GLOOM]: ['deep', 'lightless'],
  [ERarityKind.IDOL]: ['clay', 'gilded'],
  [ERarityKind.SPARK]: ['star', 'cloud'],
};

const REALM_SUFFIXES: Record<TBaseRealm, string[]> = {
  [ERarityKind.GLOOM]: ['deep-root', 'sunken-hall'],
  [ERarityKind.IDOL]: ['clay-idol', 'painted-mask'],
  [ERarityKind.SPARK]: ['high-wind', 'morning-star'],
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

function word(slot: 'prefix' | 'suffix', id: string, realms?: TBaseRealm[]): TokenWord {
  const theme = WORD_THEMES[id];
  return {
    key: wordKeyOf(slot, id),
    ...(realms ? { realms } : {}),
    ...(theme ? { theme } : {}),
  };
}

function words(
  slot: 'prefix' | 'suffix',
  shared: readonly string[],
  byRealm: Record<TBaseRealm, string[]>,
): TokenWord[] {
  const tagged = (Object.entries(byRealm) as [TBaseRealm, string[]][]).flatMap(([realm, ids]) =>
    ids.map((id) => word(slot, id, [realm])),
  );
  return [...shared.map((id) => word(slot, id)), ...tagged];
}

export const TOKEN_WORDS: WordPoolData = {
  prefixes: words('prefix', SHARED_PREFIXES, REALM_PREFIXES),
  suffixes: words('suffix', SHARED_SUFFIXES, REALM_SUFFIXES),
};

export const TOKEN_NAME_TEMPLATE_KEY = 'content.tokens.nameTemplate';

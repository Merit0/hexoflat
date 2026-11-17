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

function words(
  slot: 'prefix' | 'suffix',
  shared: readonly string[],
  byRealm: Record<TBaseRealm, string[]>,
): TokenWord[] {
  const tagged = (Object.entries(byRealm) as [TBaseRealm, string[]][]).flatMap(([realm, ids]) =>
    ids.map((id) => ({ key: wordKeyOf(slot, id), realms: [realm] })),
  );
  return [...shared.map((id) => ({ key: wordKeyOf(slot, id) })), ...tagged];
}

export const TOKEN_WORDS: WordPoolData = {
  prefixes: words('prefix', SHARED_PREFIXES, REALM_PREFIXES),
  suffixes: words('suffix', SHARED_SUFFIXES, REALM_SUFFIXES),
};

export const TOKEN_NAME_TEMPLATE_KEY = 'content.tokens.nameTemplate';

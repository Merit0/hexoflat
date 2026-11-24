import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_TOKEN_TYPES,
  MAP_TIERS,
  createTokenFactory,
  flattenTextTree,
  formatTokenAttributes,
  formatTokenDescription,
  formatTokenName,
  withAdjectiveTexts,
  type TokenDictionary,
} from '@hexoflat/engine';

const SAMPLE_SIZE = 20;
const here = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(here, '../src/locales');

function dictionaryOf(lang: string): TokenDictionary {
  return withAdjectiveTexts(
    flattenTextTree(JSON.parse(readFileSync(path.join(localesDir, lang, 'content.json'), 'utf-8'))),
    lang,
  );
}

const dictionaries = { en: dictionaryOf('en'), uk: dictionaryOf('uk') };
const factory = createTokenFactory();
const seed = process.argv[2] ?? 'sample';

for (let n = 0; n < SAMPLE_SIZE; n += 1) {
  const result = factory.createBase({
    seed,
    sourceId: 'dev:token-sample',
    n,
    tokenType: BASE_TOKEN_TYPES[n % BASE_TOKEN_TYPES.length],
    mapTier: MAP_TIERS[n % MAP_TIERS.length],
  });
  if (!result.ok) {
    console.error(`#${n} refused: ${result.refusal.code} ${result.refusal.message}`);
    process.exitCode = 1;
    continue;
  }
  const token = result.value;
  console.log(
    `#${n} ${token.id}  ${token.tokenType} tier ${token.mapTier}  ${token.attributes.length} attr  ${token.price} coins  ${token.sprite ?? 'fallback'}`,
  );
  for (const [lang, dictionary] of Object.entries(dictionaries)) {
    const name = formatTokenName(token.name, dictionary);
    const description = [
      ...formatTokenDescription(token.description, dictionary),
      ...formatTokenAttributes(token, dictionary).map((row) => `${row.label} ${row.value}`),
    ].join(' · ');
    console.log(`  ${lang}: ${name} — ${description}`);
  }
}

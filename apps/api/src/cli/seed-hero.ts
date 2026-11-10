import { SEED_PRESETS, seedHero, type SeedPreset } from '../player/admin-tools';
import { withKit } from './cli-kit';

const [login, preset = 'full'] = process.argv.slice(2);
if (!login || !(preset in SEED_PRESETS)) {
  console.error(`Usage: seed-hero <login> [${Object.keys(SEED_PRESETS).join('|')}]`);
  process.exit(1);
}

await withKit(async ({ db, heroes, commands }) => {
  const result = await seedHero(db, heroes, commands, login, preset as SeedPreset);
  console.log(`Hero ${result.heroId} got: ${result.granted.join(', ')}`);
});

import { ITEMS_DIR, MANIFEST_FILE, runSpriteManifest } from './sprite-manifest/run-sprite-manifest';

const result = runSpriteManifest({ itemsDir: ITEMS_DIR, outFile: MANIFEST_FILE });

if (!result.ok) {
  console.error(`tokens:manifest failed with ${result.failures.length} problem(s):`);
  for (const failure of result.failures) console.error(`  [${failure.code}] ${failure.message}`);
  console.error('The manifest was not written.');
  process.exitCode = 1;
} else {
  const state = result.changed ? 'written' : 'unchanged';
  console.log(`tokens:manifest: ${result.count} sprite(s), ${MANIFEST_FILE} ${state}.`);
  if (result.changed) console.log('Rebuild the engine: pnpm --filter @hexoflat/engine build');
}

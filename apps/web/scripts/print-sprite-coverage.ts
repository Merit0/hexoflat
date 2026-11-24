import { runSpriteCoverage } from './sprite-manifest/run-sprite-coverage';
import { ITEMS_DIR } from './sprite-manifest/run-sprite-manifest';

const result = runSpriteCoverage(ITEMS_DIR);

if (result.ok) {
  for (const line of result.lines) console.log(line);
} else {
  console.error(`sprites:coverage failed with ${result.failures.length} problem(s):`);
  for (const failure of result.failures) console.error(`  [${failure.code}] ${failure.message}`);
  process.exitCode = 1;
}

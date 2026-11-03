import { execFileSync } from 'node:child_process';
import { impactMap } from '../impact-map';
import { buildDepGraph } from './build-dep-graph';
import { checkE2EMap, type ListedTest } from './check-e2e-map';

interface JsonSpec {
  file: string;
  title: string;
  tags?: string[];
}

interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

function collect(suite: JsonSuite, out: ListedTest[]): void {
  for (const spec of suite.specs ?? []) {
    out.push({
      file: `e2e/${spec.file.replace(/^e2e\//, '')}`,
      title: spec.title,
      tags: (spec.tags ?? []).map((tag) => (tag.startsWith('@') ? tag : `@${tag}`)),
    });
  }
  for (const child of suite.suites ?? []) collect(child, out);
}

function listTests(): ListedTest[] {
  const raw = execFileSync('npx', ['playwright', 'test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const tests: ListedTest[] = [];
  for (const suite of (JSON.parse(raw) as { suites: JsonSuite[] }).suites) collect(suite, tests);
  return tests;
}

const { problems, unmapped } = checkE2EMap(listTests(), impactMap, await buildDepGraph());

if (unmapped.length > 0) {
  console.log(
    `${unmapped.length} file(s) in apps/web/src belong to no group and would run the whole suite:`,
  );
  for (const file of unmapped) console.log(`  unmapped  ${file}`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`e2e map: ${problem}`);
  process.exit(1);
}
console.log('e2e map: every spec has its group tag, every group has a spec.');

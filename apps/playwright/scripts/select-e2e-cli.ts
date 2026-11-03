import { execFileSync } from 'node:child_process';
import { impactMap } from '../impact-map';
import { buildDepGraph } from './build-dep-graph';
import { selectE2E, type Selection } from './select-e2e';

function changedFilesInRange(range: string): string[] {
  const out = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' });
  return out.split('\n').filter((line) => line !== '');
}

export function formatSelection(selection: Selection): string {
  const lines = selection.reasons.map((reason) => `  ${reason.file}\n    ${reason.why}`);
  const verdict =
    selection.mode === 'groups'
      ? `run groups: ${selection.groups.join(', ')}  (--grep "${selection.grep}")`
      : selection.mode === 'all'
        ? 'run the whole suite'
        : 'no e2e needed';
  return [...lines, `e2e: ${verdict}`].join('\n');
}

async function main(argv: string[]): Promise<void> {
  const json = argv.includes('--json');
  const rangeIndex = argv.indexOf('--range');
  const filesIndex = argv.indexOf('--files');
  let files: string[];
  if (rangeIndex !== -1) {
    files = changedFilesInRange(argv[rangeIndex + 1] ?? '');
  } else if (filesIndex !== -1) {
    files = argv.slice(filesIndex + 1).filter((arg) => !arg.startsWith('--'));
  } else {
    console.error('usage: select-e2e-cli (--range <base>..<head> | --files <file>...) [--json]');
    process.exit(2);
  }
  const selection = selectE2E(files, impactMap, await buildDepGraph());
  console.log(json ? JSON.stringify(selection, null, 2) : formatSelection(selection));
}

await main(process.argv.slice(2));

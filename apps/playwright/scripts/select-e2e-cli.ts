import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { impactMap } from '../impact-map';
import { buildDepGraph } from './build-dep-graph';
import { diffRanges, parsePushRefs, type GitProbe } from './push-refs';
import { selectE2E, type Selection } from './select-e2e';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function changedFilesInRange(range: string): string[] {
  return git('diff', '--name-only', range)
    .split('\n')
    .filter((line) => line !== '');
}

const realGit: GitProbe = {
  hasCommit(sha) {
    try {
      git('cat-file', '-e', `${sha}^{commit}`);
      return true;
    } catch {
      return false;
    }
  },
  mergeBase(sha) {
    try {
      return git('merge-base', sha, 'origin/main').trim() || null;
    } catch {
      return null;
    }
  },
};

function runPrePush(): void {
  const plan = diffRanges(parsePushRefs(readFileSync(0, 'utf8')), realGit);
  if (plan.fullSuiteBecause !== null) {
    console.error(`pre-push: ${plan.fullSuiteBecause} — running the whole suite.`);
    console.log('all');
    return;
  }
  const files = [...new Set(plan.ranges.flatMap(changedFilesInRange))];
  void buildDepGraph().then((graph) => {
    const selection = selectE2E(files, impactMap, graph);
    console.error(formatSelection(selection));
    console.log(selection.mode === 'groups' ? `grep:${selection.grep}` : selection.mode);
  });
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
  if (argv.includes('--pre-push')) {
    runPrePush();
    return;
  }
  const json = argv.includes('--json');
  const rangeIndex = argv.indexOf('--range');
  const filesIndex = argv.indexOf('--files');
  let files: string[];
  if (rangeIndex !== -1) {
    files = changedFilesInRange(argv[rangeIndex + 1] ?? '');
  } else if (filesIndex !== -1) {
    files = argv.slice(filesIndex + 1).filter((arg) => !arg.startsWith('--'));
  } else {
    console.error(
      'usage: select-e2e-cli (--pre-push | --range <base>..<head> | --files <file>...) [--json]',
    );
    process.exit(2);
  }
  const selection = selectE2E(files, impactMap, await buildDepGraph());
  console.log(json ? JSON.stringify(selection, null, 2) : formatSelection(selection));
}

await main(process.argv.slice(2));

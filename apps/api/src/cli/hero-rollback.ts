import { AGGREGATE_KINDS, type TAggregateKind } from '@hexoflat/engine';
import { rollbackAggregate } from '../player/admin-tools';
import { withKit } from './cli-kit';

const args = process.argv.slice(2).filter((arg) => arg !== '--yes');
const confirm = process.argv.includes('--yes');
const [heroId, kind, revisionText] = args;
const revision = Number(revisionText);
if (!heroId || !AGGREGATE_KINDS.includes(kind as TAggregateKind) || !Number.isInteger(revision)) {
  console.error(`Usage: hero-rollback <heroId> <${AGGREGATE_KINDS.join('|')}> <revision> [--yes]`);
  process.exit(1);
}

await withKit(async ({ db }) => {
  const plan = await rollbackAggregate(db, heroId, kind as TAggregateKind, revision, { confirm });
  console.log(
    `${confirm ? 'Rolled back' : 'Would roll back'} ${plan.kind}: revision ${plan.fromRevision} -> state of ${plan.toRevision}, stored as revision ${plan.newRevision}.`,
  );
  if (!confirm) console.log('Nothing changed. Run again with --yes to apply.');
});

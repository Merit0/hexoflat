import { heroHistory } from '../player/admin-tools';
import { withKit } from './cli-kit';

const [heroId] = process.argv.slice(2);
if (!heroId) {
  console.error('Usage: hero-history <heroId>');
  process.exit(1);
}

await withKit(async ({ db }) => {
  const { journal, ledger } = await heroHistory(db, heroId);
  console.log('--- command journal ---');
  for (const row of journal) {
    console.log(
      `${row.createdAt} #${row.id} ${row.commandType} ${row.result}${row.reason ? ` (${row.reason})` : ''} rev ${row.expectedRevision ?? '-'} -> ${row.newRevision ?? '-'}`,
    );
  }
  console.log('--- item ledger ---');
  for (const row of ledger) {
    console.log(
      `${row.createdAt} ${row.itemKey} ${row.delta >= 0 ? '+' : ''}${row.delta} = ${row.balanceAfter} (${row.reason})`,
    );
  }
});

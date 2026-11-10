import { and, count, like, lt } from 'drizzle-orm';
import { users } from '../db/schema';
import { withKit } from './cli-kit';

if (process.env.NODE_ENV === 'production') {
  console.error('e2e-cleanup is refused in production.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const all = args.includes('--all');
const hoursIndex = args.indexOf('--older-than-hours');
const hours = hoursIndex >= 0 ? Number(args[hoursIndex + 1]) : 24;
if (!Number.isFinite(hours) || hours < 0) {
  console.error('Usage: e2e-cleanup [--all] [--older-than-hours N] [--dry-run]');
  process.exit(1);
}

await withKit(async ({ db }) => {
  const cutoff = new Date(Date.now() - (all ? 0 : hours) * 3_600_000).toISOString();
  const target = and(like(users.username, 'e2e-%'), lt(users.createdAt, cutoff));
  const [{ total }] = await db.select({ total: count() }).from(users).where(target);
  if (dryRun) {
    console.log(`Would delete ${total} e2e users created before ${cutoff}.`);
    return;
  }
  await db.delete(users).where(target);
  console.log(
    `Deleted ${total} e2e users created before ${cutoff} (heroes and their data cascade).`,
  );
});

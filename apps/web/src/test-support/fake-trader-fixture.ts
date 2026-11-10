import { AGGREGATES, applyTraderFixture, traderFixtureSchema } from '@hexoflat/engine';
import { FAKE_RNG_SEED, fakeProgressRow } from './fake-player-server';

export function fakeTraderFixture(body: unknown) {
  const row = fakeProgressRow();
  const next = applyTraderFixture(row.state, FAKE_RNG_SEED, traderFixtureSchema.parse(body));
  if (!next) throw new Error('INVALID_COMMAND');
  row.revision += 1;
  row.state = next;
  const state = AGGREGATES.progress.project(next, { rngSeed: FAKE_RNG_SEED });
  return { aggregates: { progress: { revision: row.revision, state } } };
}

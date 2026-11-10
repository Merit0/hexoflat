export function e2eFixturesEnabled(): boolean {
  return process.env.HEXOFLAT_E2E_FIXTURES === '1' && process.env.NODE_ENV !== 'production';
}

export function assertE2eFixturesSafe(): void {
  if (process.env.NODE_ENV === 'production' && process.env.HEXOFLAT_E2E_FIXTURES === '1') {
    throw new Error(
      'HEXOFLAT_E2E_FIXTURES=1 is not allowed in production (refusing to start with test fixtures on).',
    );
  }
}

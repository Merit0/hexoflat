export const DEFAULT_DATABASE_URL = 'postgresql://hexoflat:hexoflat@localhost:5433/hexoflat';

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === 'production' && (!url || url === DEFAULT_DATABASE_URL)) {
    throw new Error(
      'DATABASE_URL must be set to a real connection string in production (refusing to start with the default dev database).',
    );
  }

  return url ?? DEFAULT_DATABASE_URL;
}

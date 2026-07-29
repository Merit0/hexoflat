export const DEFAULT_DATABASE_URL = 'postgresql://hexoflat:hexoflat@localhost:5433/hexoflat';

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_DATABASE_URL, getDatabaseUrl } from './env';

describe('getDatabaseUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('falls back to the default dev connection string outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;

    expect(getDatabaseUrl()).toBe(DEFAULT_DATABASE_URL);
  });

  it('returns a configured DATABASE_URL as-is', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://real:real@db-host:5432/hexoflat';

    expect(getDatabaseUrl()).toBe('postgresql://real:real@db-host:5432/hexoflat');
  });

  it('throws in production when DATABASE_URL is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;

    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL must be set/);
  });

  it('throws in production when DATABASE_URL is still the default dev value', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;

    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL must be set/);
  });

  it('does not throw in production once a real DATABASE_URL is configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://real:real@db-host:5432/hexoflat';

    expect(getDatabaseUrl()).toBe('postgresql://real:real@db-host:5432/hexoflat');
  });
});

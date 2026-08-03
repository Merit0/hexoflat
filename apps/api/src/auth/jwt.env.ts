import type { JwtSignOptions } from '@nestjs/jwt';

type ExpiresIn = JwtSignOptions['expiresIn'];

export const DEFAULT_JWT_SECRET = 'dev-insecure-secret-change-me';
export const DEFAULT_JWT_EXPIRES_IN = '7d' as ExpiresIn;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production' && (!secret || secret === DEFAULT_JWT_SECRET)) {
    throw new Error(
      'JWT_SECRET must be set to a real secret in production (refusing to start with the default dev secret).',
    );
  }

  return secret ?? DEFAULT_JWT_SECRET;
}

export function getJwtExpiresIn(): ExpiresIn {
  return (process.env.JWT_EXPIRES_IN as ExpiresIn) ?? DEFAULT_JWT_EXPIRES_IN;
}

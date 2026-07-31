import type { JwtSignOptions } from '@nestjs/jwt';

type ExpiresIn = JwtSignOptions['expiresIn'];

export const DEFAULT_JWT_SECRET = 'dev-insecure-secret-change-me';
export const DEFAULT_JWT_EXPIRES_IN = '7d' as ExpiresIn;

export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;
}

export function getJwtExpiresIn(): ExpiresIn {
  return (process.env.JWT_EXPIRES_IN as ExpiresIn) ?? DEFAULT_JWT_EXPIRES_IN;
}

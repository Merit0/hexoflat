import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { DB, type Db } from '../db/db.module';
import { users } from '../db/schema';

export interface AuthenticatedUser {
  sub: string;
}

export type AuthenticatedRequest = FastifyRequest & { user: AuthenticatedUser };

interface JwtPayload {
  sub: string;
  tokenVersion: number;
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Shared by JwtAuthGuard (Bearer header) and the GET /auth/session endpoint
// (session cookie) so the revocation check only lives in one place.
export async function verifyAccessToken(
  jwtService: JwtService,
  db: Db,
  token: string,
): Promise<AuthenticatedUser> {
  let payload: JwtPayload;
  try {
    payload = await jwtService.verifyAsync<JwtPayload>(token);
  } catch {
    throw new UnauthorizedException('Invalid or expired token.');
  }

  // Catches tokens revoked via logout/password-change: a valid signature
  // alone isn't enough once the user's stored tokenVersion has moved past
  // the one this token was issued with.
  const [record] = await db
    .select({ tokenVersion: users.tokenVersion })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!record || record.tokenVersion !== payload.tokenVersion) {
    throw new UnauthorizedException('Token has been revoked.');
  }

  return { sub: payload.sub };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    request.user = await verifyAccessToken(this.jwtService, this.db, token);
    return true;
  }
}

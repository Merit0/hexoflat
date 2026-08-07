import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DB, type Db } from '../db/db.module';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard, verifyAccessToken, type AuthenticatedRequest } from './jwt-auth.guard';
import { AuthService, type AuthResult } from './auth.service';
import { LoginDto, LoginDtoSchema, RegisterDto, RegisterDtoSchema } from './auth.dto';

// Fastify's cookie `maxAge` wants seconds, not the '7d'-style string
// JWT_EXPIRES_IN uses (see jwt.env.ts) — kept as a plain constant here since
// there's no existing time-string parser in the repo to reuse.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function setSessionCookie(reply: FastifyReply, accessToken: string, persistent: boolean): void {
  reply.setCookie('session', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(persistent ? { maxAge: SESSION_COOKIE_MAX_AGE_SECONDS } : {}),
  });
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginDtoSchema))
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResult> {
    const result = await this.authService.login(dto);
    setSessionCookie(reply, result.accessToken, dto.rememberMe);
    return result;
  }

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterDtoSchema))
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResult> {
    const result = await this.authService.register(dto);
    setSessionCookie(reply, result.accessToken, true);
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.authService.logout(request.user.sub);
    reply.clearCookie('session', { path: '/' });
  }

  // Silent session restore on app boot. The `session` cookie can only ever
  // reach this one read-only endpoint — every guarded, mutating endpoint
  // still requires the explicit Bearer header JS attaches from the
  // in-memory access token, which this endpoint hands back but never reads
  // from the cookie itself. That keeps the CSRF surface where it already
  // was, so no separate CSRF-token scheme is needed here.
  //
  // @SkipThrottle(): unlike login/register, this endpoint can't be brute-
  // forced — a request either carries a valid signed cookie or it doesn't,
  // there's no secret to guess by hammering it. ThrottlerGuard buckets are
  // per-route (keyed by class+handler, see its generateKey()), so this
  // endpoint had its own 5-req/60s budget — but it also fires on every page
  // load/reload, so a handful of ordinary refreshes was enough to 429 a
  // perfectly valid session all on its own.
  @SkipThrottle()
  @Get('session')
  async session(@Req() request: FastifyRequest): Promise<AuthResult> {
    const token = request.cookies.session;
    if (!token) {
      throw new UnauthorizedException('No session cookie.');
    }

    const user = await verifyAccessToken(this.jwtService, this.db, token);
    return this.authService.refreshSession(user.sub);
  }
}

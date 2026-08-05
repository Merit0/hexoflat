import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { DB, type Db } from '../db/db.module';
import { users } from '../db/schema';
import type { LoginDto, RegisterDto } from './auth.dto';

const PASSWORD_SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  username: string;
  name: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

function toPublicUser(user: { id: string; username: string; name: string }): PublicUser {
  const { id, username, name } = user;
  return { id, username, name };
}

@Injectable()
export class AuthService {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  private issueToken(user: PublicUser, tokenVersion: number): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, username: user.username, tokenVersion });
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);
    if (existing) {
      throw new ConflictException('Username already taken.');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const [record] = await this.db
      .insert(users)
      .values({ username: dto.username, password: passwordHash, name: dto.name })
      .returning();

    const user = toPublicUser(record);
    return { user, accessToken: await this.issueToken(user, record.tokenVersion) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const [record] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);
    if (!record || !(await bcrypt.compare(dto.password, record.password))) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const user = toPublicUser(record);
    return { user, accessToken: await this.issueToken(user, record.tokenVersion) };
  }

  // The actual revocation: every token issued before this bump carries the
  // old tokenVersion, so JwtAuthGuard's lookup rejects it from here on.
  async logout(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }
}

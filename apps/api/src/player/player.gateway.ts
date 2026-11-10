import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/jwt-auth.guard';
import { DB, type Db } from '../db/db.module';
import { HeroesService } from '../heroes/heroes.service';
import { HERO_SESSIONS, HeroRateLimiter, type HeroSessions } from './hero-sessions';
import { WorldService } from '../world/world.service';
import { PlayerCommandService } from './player-command.service';
import { PlayerCommandError, type PlayerErrorCode } from './player-command.types';

interface PlayerSocketData {
  userId: string;
}

type PlayerSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  Partial<PlayerSocketData>
>;

const SubscribeSchema = z.object({ heroId: z.uuid().optional() }).strict();

@WebSocketGateway({
  namespace: 'player',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' },
  maxPayload: 16 * 1024,
})
export class PlayerGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly limiter = new HeroRateLimiter();
  private namespace!: Namespace;

  constructor(
    @Inject(PlayerCommandService) private readonly commands: PlayerCommandService,
    @Inject(HeroesService) private readonly heroes: HeroesService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(DB) private readonly db: Db,
    @Inject(HERO_SESSIONS) private readonly sessions: HeroSessions,
    @Inject(WorldService) private readonly world: WorldService,
  ) {}

  afterInit(namespace: Namespace): void {
    this.namespace = namespace;
    namespace.use((socket: PlayerSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('Missing auth token'));
        return;
      }
      verifyAccessToken(this.jwtService, this.db, token)
        .then((user) => {
          socket.data.userId = user.sub;
          next();
        })
        .catch(() => next(new Error('Invalid or expired token')));
    });
  }

  @SubscribeMessage('hero:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: PlayerSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = client.data.userId;
    const parsed = SubscribeSchema.safeParse(body ?? {});
    if (!userId || !parsed.success) {
      this.fail(client, 'INVALID_ENVELOPE');
      return;
    }
    try {
      const heroId = parsed.data.heroId ?? (await this.heroes.findOrCreateByUserId(userId)).id;
      const snapshot = await this.commands.snapshot(userId, heroId);
      const replaced = this.sessions.claim(heroId, client.id);
      if (replaced) this.takeOver(replaced);
      client.emit('hero:snapshot', { ...snapshot, sessionToken: this.sessions.tokenOf(heroId) });
    } catch (error) {
      this.fail(client, error);
    }
  }

  @SubscribeMessage('hero:command')
  async handleCommand(
    @ConnectedSocket() client: PlayerSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = client.data.userId;
    const heroId = this.sessions.heroOf(client.id);
    const commandId = (body as { commandId?: unknown } | null)?.commandId;
    if (!userId || !heroId || !this.sessions.isActive(heroId, client.id)) {
      this.fail(client, 'SESSION_TAKEN_OVER', commandId);
      return;
    }
    if (!this.limiter.allow(heroId)) {
      this.fail(client, 'RATE_LIMITED', commandId);
      return;
    }
    const sent = (body as { heroId?: unknown } | null)?.heroId;
    if (sent !== heroId) {
      this.fail(client, 'FORBIDDEN', commandId);
      return;
    }
    try {
      client.emit('hero:result', await this.commands.execute(userId, body));
    } catch (error) {
      this.fail(client, error, commandId);
    }
  }

  @SubscribeMessage('world:command')
  async handleWorldCommand(
    @ConnectedSocket() client: PlayerSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = client.data.userId;
    const heroId = this.sessions.heroOf(client.id);
    const commandId = (body as { commandId?: unknown } | null)?.commandId;
    if (!userId || !heroId || !this.sessions.isActive(heroId, client.id)) {
      this.fail(client, 'SESSION_TAKEN_OVER', commandId);
      return;
    }
    if (!this.limiter.allow(heroId)) {
      this.fail(client, 'RATE_LIMITED', commandId);
      return;
    }
    if ((body as { heroId?: unknown } | null)?.heroId !== heroId) {
      this.fail(client, 'FORBIDDEN', commandId);
      return;
    }
    try {
      client.emit('world:result', await this.world.execute(userId, body));
    } catch (error) {
      this.fail(client, error, commandId);
    }
  }

  handleDisconnect(client: PlayerSocket): void {
    this.sessions.release(client.id);
  }

  private takeOver(socketId: string): void {
    const old = this.namespace.sockets.get(socketId);
    if (!old) return;
    old.emit('hero:error', { code: 'SESSION_TAKEN_OVER' });
    old.disconnect(true);
  }

  private fail(client: PlayerSocket, error: unknown, commandId?: unknown): void {
    const code: PlayerErrorCode | 'INTERNAL' =
      typeof error === 'string'
        ? (error as PlayerErrorCode)
        : error instanceof PlayerCommandError
          ? error.code
          : 'INTERNAL';
    client.emit('hero:error', {
      code,
      ...(typeof commandId === 'string' ? { commandId } : {}),
    });
  }
}

import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  HEX_ENGINE_COMMAND_SCHEMAS,
  serializeState,
  type HexEngineCommand,
} from '@hexoflat/engine';
import { HeroesService } from '../heroes/heroes.service';
import { createServerActionContext } from './server-action-context';
import { ScenarioStateService } from './scenario-state.service';

interface SocketData {
  scenarioId: string;
  userId: string;
  heroId: string;
}

type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Partial<SocketData>>;

const JoinScenarioSchema = z.object({
  scenarioId: z.string().min(1),
});

const CommandEnvelopeSchema = z.object({
  scenarioId: z.string().min(1),
  command: z.object({ type: z.string() }).passthrough(),
});

function scenarioRoom(scenarioId: string): string {
  return `scenario:${scenarioId}`;
}

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' } })
export class GameGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private static readonly COMMAND_RATE_LIMIT = 10;
  private static readonly COMMAND_RATE_WINDOW_MS = 1_000;

  private readonly roomClients = new Map<string, Set<string>>();
  // Per-socket fixed-window counter — unlike AuthController's `@nestjs/throttler`
  // gate (HTTP-only, IP-keyed), a WS gateway sees a persistent connection with
  // no per-message IP re-extraction, so a small hand-rolled counter keyed by
  // socket id is simpler than wiring the HTTP-shaped throttler guard here.
  private readonly commandRateLimiter = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();

  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(
    @Inject(ScenarioStateService) private readonly scenarioState: ScenarioStateService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(HeroesService) private readonly heroesService: HeroesService,
  ) {}

  // Auth runs as connection middleware (not a handleConnection lifecycle hook)
  // so an unauthenticated client gets a proper `connect_error` and never
  // completes the Socket.IO handshake, instead of racing a connect/disconnect pair.
  afterInit(server: Server): void {
    server.use((socket: AppSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('Missing auth token'));
        return;
      }

      this.jwtService
        .verifyAsync<{ sub: string }>(token)
        .then((payload) => {
          socket.data.userId = payload.sub;
          next();
        })
        .catch(() => next(new Error('Invalid or expired token')));
    });
  }

  @SubscribeMessage('join-scenario')
  async handleJoinScenario(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const parsed = JoinScenarioSchema.safeParse(body);
    if (!parsed.success) {
      client.emit('error', { message: 'Invalid join-scenario payload' });
      return;
    }

    const ownerId = await this.scenarioState.getScenarioOwnerId(parsed.data.scenarioId);
    if (ownerId !== userId) {
      client.emit('error', { message: 'Not authorized for this scenario' });
      return;
    }

    const hero = await this.heroesService.findByUserId(userId);
    if (!hero) {
      client.emit('error', { message: 'No hero found for this user' });
      return;
    }

    const { scenarioId } = parsed.data;
    const heroId = hero.id;

    // Load state before joining the socket.io room: a stale/corrupted
    // snapshot must reject the join outright, not leave the client sitting
    // in a room it never got a state-sync for.
    let state;
    try {
      await this.scenarioState.ensureHero(scenarioId, userId, heroId);
      state = await this.scenarioState.getOrCreate(scenarioId);
    } catch {
      client.emit('error', {
        message: 'Could not load this scenario — its saved state is stale or corrupted.',
      });
      return;
    }

    await client.join(scenarioRoom(scenarioId));
    client.data.scenarioId = scenarioId;
    client.data.heroId = heroId;

    let clients = this.roomClients.get(scenarioId);
    if (!clients) {
      clients = new Set();
      this.roomClients.set(scenarioId, clients);
    }
    clients.add(client.id);

    client.emit('state-sync', serializeState(state));
  }

  @SubscribeMessage('command')
  handleCommand(@ConnectedSocket() client: AppSocket, @MessageBody() body: unknown): void {
    if (this.isRateLimited(client.id)) {
      client.emit('error', { message: 'Too many commands — slow down.' });
      return;
    }

    const parsed = CommandEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      client.emit('error', { message: 'Invalid command payload' });
      return;
    }

    const { scenarioId, command } = parsed.data;
    if (client.data.scenarioId !== scenarioId) {
      client.emit('error', { message: 'Not joined to this scenario' });
      return;
    }

    const schema = HEX_ENGINE_COMMAND_SCHEMAS[command.type as HexEngineCommand['type']];
    if (!schema) {
      client.emit('error', { message: `Unknown command type: ${command.type}` });
      return;
    }

    const parsedCommand = schema.safeParse(command);
    if (!parsedCommand.success) {
      client.emit('error', { message: 'Invalid command payload' });
      return;
    }

    // The client says who it is; the server decides. `actorId` is overwritten
    // with the authenticated user rather than trusted from the wire — it is
    // the field co-op ACL and the audit trail will read.
    //
    // Checked rather than asserted: `actorId` is `min(1)` in the schema and
    // applyCommand re-parses, so a missing userId would throw out of the
    // dispatch below instead of failing the command cleanly.
    const { userId } = client.data;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const hexCommand = { ...parsedCommand.data, actorId: userId };
    const isHeroScoped =
      hexCommand.type === 'MOVE_HERO' ||
      hexCommand.type === 'START_HEX_ACTION' ||
      hexCommand.type === 'ADD_RESOURCE_SPAWNER';
    if (isHeroScoped && hexCommand.payload.heroId !== client.data.heroId) {
      client.emit('error', { message: 'Cannot act as a hero you do not control' });
      return;
    }

    const result = this.scenarioState.dispatch(scenarioId, hexCommand, createServerActionContext());
    this.server.to(scenarioRoom(scenarioId)).emit('state-update', {
      events: result.events,
      state: serializeState(result.state),
    });
  }

  async handleDisconnect(client: AppSocket): Promise<void> {
    this.commandRateLimiter.delete(client.id);

    const { scenarioId } = client.data;
    if (!scenarioId) {
      return;
    }

    const clients = this.roomClients.get(scenarioId);
    if (!clients) {
      return;
    }

    clients.delete(client.id);
    if (clients.size === 0) {
      this.roomClients.delete(scenarioId);
      await this.scenarioState.release(scenarioId);
    }
  }

  private isRateLimited(clientId: string): boolean {
    const now = Date.now();
    const entry = this.commandRateLimiter.get(clientId);

    if (!entry || now - entry.windowStartedAt >= GameGateway.COMMAND_RATE_WINDOW_MS) {
      this.commandRateLimiter.set(clientId, { count: 1, windowStartedAt: now });
      return false;
    }

    entry.count += 1;
    return entry.count > GameGateway.COMMAND_RATE_LIMIT;
  }
}

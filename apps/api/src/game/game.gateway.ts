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

  private readonly roomClients = new Map<string, Set<string>>();

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
    await client.join(scenarioRoom(scenarioId));
    client.data.scenarioId = scenarioId;
    client.data.heroId = heroId;

    let clients = this.roomClients.get(scenarioId);
    if (!clients) {
      clients = new Set();
      this.roomClients.set(scenarioId, clients);
    }
    clients.add(client.id);

    await this.scenarioState.ensureHero(scenarioId, userId, heroId);
    const state = await this.scenarioState.getOrCreate(scenarioId);
    client.emit('state-sync', serializeState(state));
  }

  @SubscribeMessage('command')
  handleCommand(@ConnectedSocket() client: AppSocket, @MessageBody() body: unknown): void {
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

    const hexCommand = parsedCommand.data;
    if (hexCommand.type === 'MOVE_HERO' && hexCommand.payload.heroId !== client.data.heroId) {
      client.emit('error', { message: 'Cannot move a hero you do not control' });
      return;
    }

    const result = this.scenarioState.dispatch(scenarioId, hexCommand, createServerActionContext());
    this.server.to(scenarioRoom(scenarioId)).emit('state-update', {
      events: result.events,
      state: serializeState(result.state),
    });
  }

  async handleDisconnect(client: AppSocket): Promise<void> {
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
}

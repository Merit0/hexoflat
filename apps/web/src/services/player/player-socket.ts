import { io, type Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface ProjectedAggregate {
  revision: number;
  state: unknown;
}

export interface HeroSnapshot {
  heroId: string;
  sessionToken?: string | null;
  aggregates: { inventory?: ProjectedAggregate; progress?: ProjectedAggregate };
}

export interface PlayerCommandResponse {
  commandId: string;
  result: 'applied' | 'rejected' | 'conflict';
  code?: string;
  replayed?: boolean;
  events: { type: string; payload?: unknown }[];
  aggregates: HeroSnapshot['aggregates'];
}

export interface WorldCommandResponse extends PlayerCommandResponse {
  tileDiffs: { coordinates: { columnIndex: number; rowIndex: number }; tile: unknown }[];
  effects: { kind: string; [field: string]: unknown }[];
  engagement?: unknown;
  hero: {
    locationKey: string;
    mapId: string;
    coordinates: { columnIndex: number; rowIndex: number } | null;
  } | null;
}

export interface PlayerEnvelope {
  commandId: string;
  heroId: string;
  aggregate: 'inventory' | 'progress';
  expectedRevision: number;
  command: { type: string; payload: Record<string, unknown> };
}

export class PlayerSocketError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'PlayerSocketError';
  }
}

interface Pending {
  resolve(response: PlayerCommandResponse): void;
  reject(error: PlayerSocketError): void;
}

export class PlayerSocket {
  private socket: Socket | null = null;
  private readonly pending = new Map<string, Pending>();
  private takenOver: (() => void) | null = null;
  private waitingSnapshot: Pending | null = null;

  onTakenOver(listener: () => void): void {
    this.takenOver = listener;
  }

  get connected(): boolean {
    return this.socket?.connected === true;
  }

  connect(token: string): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const socket = io(`${API_BASE_URL}/player`, {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
        reconnection: false,
      });
      this.socket = socket;
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error: Error) => reject(new PlayerSocketError(error.message)));
      socket.on('hero:result', (response: PlayerCommandResponse) => {
        const waiting = this.pending.get(response.commandId);
        this.pending.delete(response.commandId);
        waiting?.resolve(response);
      });
      socket.on('world:result', (response: PlayerCommandResponse) => {
        const waiting = this.pending.get(response.commandId);
        this.pending.delete(response.commandId);
        waiting?.resolve(response);
      });
      socket.on('hero:error', (payload: { code: string; commandId?: string }) => {
        if (payload.code === 'SESSION_TAKEN_OVER' && !payload.commandId) {
          this.failAll('SESSION_TAKEN_OVER');
          this.takenOver?.();
          return;
        }
        if (payload.commandId) {
          const waiting = this.pending.get(payload.commandId);
          this.pending.delete(payload.commandId);
          waiting?.reject(new PlayerSocketError(payload.code));
          return;
        }
        this.waitingSnapshot?.reject(new PlayerSocketError(payload.code));
        this.waitingSnapshot = null;
      });
      socket.on('disconnect', () => this.failAll('DISCONNECTED'));
    });
  }

  subscribe(heroId?: string): Promise<HeroSnapshot> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new PlayerSocketError('DISCONNECTED'));
    return new Promise<HeroSnapshot>((resolve, reject) => {
      this.waitingSnapshot = { resolve: resolve as never, reject };
      socket.once('hero:snapshot', (snapshot: HeroSnapshot) => {
        this.waitingSnapshot = null;
        resolve(snapshot);
      });
      socket.emit('hero:subscribe', heroId ? { heroId } : {});
    });
  }

  send(envelope: PlayerEnvelope): Promise<PlayerCommandResponse> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.reject(new PlayerSocketError('DISCONNECTED'));
    return new Promise((resolve, reject) => {
      this.pending.set(envelope.commandId, { resolve, reject });
      socket.emit('hero:command', envelope);
    });
  }

  sendWorld(envelope: PlayerEnvelope): Promise<WorldCommandResponse> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.reject(new PlayerSocketError('DISCONNECTED'));
    return new Promise((resolve, reject) => {
      this.pending.set(envelope.commandId, { resolve: resolve as never, reject });
      socket.emit('world:command', envelope);
    });
  }

  close(): void {
    this.failAll('DISCONNECTED');
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
  }

  private failAll(code: string): void {
    for (const waiting of this.pending.values()) waiting.reject(new PlayerSocketError(code));
    this.pending.clear();
    this.waitingSnapshot?.reject(new PlayerSocketError(code));
    this.waitingSnapshot = null;
  }
}

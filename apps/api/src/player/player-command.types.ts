import { z } from 'zod';
import { AGGREGATE_KINDS, type DomainEvent, type TAggregateKind } from '@hexoflat/engine';

export const MAX_COMMAND_BYTES = 8 * 1024;

export const PlayerCommandEnvelopeSchema = z
  .object({
    commandId: z.uuid(),
    heroId: z.uuid(),
    aggregate: z.enum(AGGREGATE_KINDS),
    expectedRevision: z.number().int().nonnegative(),
    command: z.object({ type: z.string().min(1).max(64), payload: z.unknown() }).strict(),
  })
  .strict();
export type PlayerCommandEnvelope = z.infer<typeof PlayerCommandEnvelopeSchema>;

export type PlayerErrorCode =
  | 'INVALID_ENVELOPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNKNOWN_COMMAND'
  | 'INVALID_COMMAND'
  | 'AGGREGATE_MISMATCH'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'SESSION_TAKEN_OVER';

export class PlayerCommandError extends Error {
  constructor(readonly code: PlayerErrorCode) {
    super(code);
  }
}

export interface ProjectedAggregate {
  revision: number;
  state: unknown;
}

export type ProjectedAggregates = { [K in TAggregateKind]?: ProjectedAggregate };

export interface PlayerCommandResponse {
  commandId: string;
  result: 'applied' | 'rejected' | 'conflict';
  code?: string;
  replayed?: boolean;
  events: DomainEvent[];
  aggregates: ProjectedAggregates;
}

export interface HeroSnapshot {
  heroId: string;
  aggregates: ProjectedAggregates;
}

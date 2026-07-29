import { Injectable } from '@nestjs/common';
import {
  applyCommand,
  type HexEngineActionContext,
  type HexEngineCommand,
  type HexEngineState,
} from '@hexoflat/engine';

/**
 * Nest-side DI wrapper around the engine's applyCommand entrypoint.
 * No Nest/Fastify concerns leak into `packages/engine` — this class is the boundary.
 */
@Injectable()
export class GameEngineService {
  dispatch(state: HexEngineState, command: HexEngineCommand, ctx: HexEngineActionContext) {
    return applyCommand(state, command, ctx);
  }
}

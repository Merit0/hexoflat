import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { DB, type Db } from '../db/db.module';
import { HeroesService } from '../heroes/heroes.service';
import { HERO_SESSIONS, type HeroSessions } from '../player/hero-sessions';
import { ExpeditionError, ensureExpedition, loadBlobs, patchBlobs } from './expedition-store';

const PatchSchema = z
  .object({
    put: z.record(z.string().max(80), z.string()).default({}),
    remove: z.array(z.string().max(80)).max(64).default([]),
  })
  .strict();

@Controller('expeditions')
@UseGuards(JwtAuthGuard)
export class ExpeditionController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroes: HeroesService,
    @Inject(HERO_SESSIONS) private readonly sessions: HeroSessions,
  ) {}

  @Get('current')
  async current(@Req() request: AuthenticatedRequest) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    const expeditionId = await ensureExpedition(this.db, request.user.sub, hero.id);
    return { expeditionId, blobs: await loadBlobs(this.db, expeditionId) };
  }

  @Patch('current')
  async patch(
    @Req() request: AuthenticatedRequest,
    @Headers('x-player-session') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    if (!this.sessions.isValidToken(hero.id, sessionToken)) {
      throw new ConflictException({ code: 'SESSION_TAKEN_OVER' });
    }
    const parsed = PatchSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_COMMAND' });
    const expeditionId = await ensureExpedition(this.db, request.user.sub, hero.id);
    try {
      const revision = await patchBlobs(this.db, expeditionId, parsed.data.put, parsed.data.remove);
      return { revision };
    } catch (error) {
      if (error instanceof ExpeditionError) throw new BadRequestException({ code: error.code });
      throw error;
    }
  }
}

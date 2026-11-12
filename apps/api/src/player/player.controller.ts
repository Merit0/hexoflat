import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { HeroesService } from '../heroes/heroes.service';
import { WorldService } from '../world/world.service';
import { HERO_SESSIONS, type HeroSessions } from './hero-sessions';
import { PlayerCommandService } from './player-command.service';
import { PlayerCommandError } from './player-command.types';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(
    @Inject(PlayerCommandService) private readonly commands: PlayerCommandService,
    @Inject(HeroesService) private readonly heroes: HeroesService,
    @Inject(WorldService) private readonly world: WorldService,
    @Inject(HERO_SESSIONS) private readonly sessions: HeroSessions,
  ) {}

  @Post('dev/reset')
  async reset(@Req() request: AuthenticatedRequest) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    try {
      return await this.commands.resetHero(request.user.sub, hero.id);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }

  @Post('dev/battle-fixture')
  async battleFixture(
    @Req() request: AuthenticatedRequest,
    @Headers('x-player-session') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    if (!this.sessions.isValidToken(hero.id, sessionToken)) {
      throw new ConflictException({ code: 'SESSION_TAKEN_OVER' });
    }
    try {
      return await this.world.battleFixture(request.user.sub, hero.id, body);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }

  @Post('dev/world-fixture')
  async worldFixture(
    @Req() request: AuthenticatedRequest,
    @Headers('x-player-session') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    if (!this.sessions.isValidToken(hero.id, sessionToken)) {
      throw new ConflictException({ code: 'SESSION_TAKEN_OVER' });
    }
    try {
      return await this.world.worldFixture(request.user.sub, hero.id, body);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }

  @Post('dev/trader-fixture')
  async traderFixture(
    @Req() request: AuthenticatedRequest,
    @Headers('x-player-session') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    if (!this.sessions.isValidToken(hero.id, sessionToken)) {
      throw new ConflictException({ code: 'SESSION_TAKEN_OVER' });
    }
    try {
      return await this.commands.traderFixture(request.user.sub, hero.id, body);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }

  @Get('world')
  async worldSnapshot(@Req() request: AuthenticatedRequest) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    try {
      return await this.world.snapshot(request.user.sub, hero.id);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }

  @Post('world/ensure')
  async ensureWorld(
    @Req() request: AuthenticatedRequest,
    @Headers('x-player-session') sessionToken: string | undefined,
    @Body() body: unknown,
  ) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    if (!this.sessions.isValidToken(hero.id, sessionToken)) {
      throw new ConflictException({ code: 'SESSION_TAKEN_OVER' });
    }
    const parsed = z
      .object({ locationKey: z.enum(LOCATION_KEYS) })
      .strict()
      .safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_COMMAND' });
    return this.world.ensure(request.user.sub, hero.id, parsed.data.locationKey);
  }

  @Get('snapshot')
  async snapshot(@Req() request: AuthenticatedRequest) {
    const hero = await this.heroes.findOrCreateByUserId(request.user.sub);
    try {
      return await this.commands.snapshot(request.user.sub, hero.id);
    } catch (error) {
      if (error instanceof PlayerCommandError) throw new ForbiddenException({ code: error.code });
      throw error;
    }
  }
}

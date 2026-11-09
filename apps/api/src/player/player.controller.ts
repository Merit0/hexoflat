import { Controller, ForbiddenException, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { HeroesService } from '../heroes/heroes.service';
import { PlayerCommandService } from './player-command.service';
import { PlayerCommandError } from './player-command.types';

@Controller('player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(
    @Inject(PlayerCommandService) private readonly commands: PlayerCommandService,
    @Inject(HeroesService) private readonly heroes: HeroesService,
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

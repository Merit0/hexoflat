import { Controller, Get, Inject, NotFoundException, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HeroesService } from './heroes.service';

@Controller('heroes')
@UseGuards(JwtAuthGuard)
export class HeroesController {
  constructor(@Inject(HeroesService) private readonly heroesService: HeroesService) {}

  @Get('me')
  async getMine(@Req() request: AuthenticatedRequest) {
    const userId = request.user.sub;
    const hero = await this.heroesService.findByUserId(userId);
    if (!hero) {
      throw new NotFoundException(`No hero found for user [ ${userId} ]`);
    }
    return hero;
  }
}

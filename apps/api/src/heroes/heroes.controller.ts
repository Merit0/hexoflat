import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HeroesService } from './heroes.service';

@Controller('heroes')
@UseGuards(JwtAuthGuard)
export class HeroesController {
  constructor(@Inject(HeroesService) private readonly heroesService: HeroesService) {}

  @Get('me')
  async getMine(@Req() request: AuthenticatedRequest) {
    return this.heroesService.findOrCreateByUserId(request.user.sub);
  }
}

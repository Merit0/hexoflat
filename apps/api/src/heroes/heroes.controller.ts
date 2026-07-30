import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { HeroesService } from './heroes.service';

@Controller('heroes')
export class HeroesController {
  constructor(@Inject(HeroesService) private readonly heroesService: HeroesService) {}

  @Get(':userId')
  async getByUserId(@Param('userId') userId: string) {
    const hero = await this.heroesService.findByUserId(userId);
    if (!hero) {
      throw new NotFoundException(`No hero found for user [ ${userId} ]`);
    }
    return hero;
  }
}

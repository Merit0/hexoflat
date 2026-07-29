import { Body, Controller, Get, Inject, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GameService } from './game.service';
import { CreateSaveDto, CreateSaveDtoSchema } from './game.dto';

@Controller('saves')
export class GameController {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(GameService) private readonly gameService: GameService) {}

  @Get()
  list() {
    return this.gameService.list();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateSaveDtoSchema))
  create(@Body() dto: CreateSaveDto) {
    return this.gameService.create(dto);
  }
}

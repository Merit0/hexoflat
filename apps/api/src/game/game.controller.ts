import { Body, Controller, Get, Inject, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { GameService } from './game.service';
import { CreateSaveDto, CreateSaveDtoSchema } from './game.dto';

@Controller('saves')
@UseGuards(JwtAuthGuard)
export class GameController {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(GameService) private readonly gameService: GameService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.gameService.list(request.user.sub);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateSaveDtoSchema))
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateSaveDto) {
    return this.gameService.create(request.user.sub, dto);
  }
}

import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameEngineService } from './game-engine.service';

@Module({
  controllers: [GameController],
  providers: [GameService, GameEngineService],
})
export class GameModule {}

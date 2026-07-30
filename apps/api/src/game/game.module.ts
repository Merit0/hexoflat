import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameEngineService } from './game-engine.service';
import { ScenarioStateService } from './scenario-state.service';

@Module({
  imports: [HeroesModule],
  controllers: [GameController],
  providers: [GameService, GameEngineService, ScenarioStateService, GameGateway],
})
export class GameModule {}

import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { PlayerCommandService } from './player-command.service';
import { PlayerController } from './player.controller';
import { PlayerGateway } from './player.gateway';

@Module({
  imports: [HeroesModule],
  controllers: [PlayerController],
  providers: [PlayerCommandService, PlayerGateway],
  exports: [PlayerCommandService],
})
export class PlayerModule {}

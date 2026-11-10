import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ExpeditionController } from '../expedition/expedition.controller';
import { HERO_SESSIONS, HeroSessions } from './hero-sessions';
import { WorldService } from '../world/world.service';
import { PlayerCommandService } from './player-command.service';
import { PlayerController } from './player.controller';
import { PlayerGateway } from './player.gateway';

@Module({
  imports: [HeroesModule],
  controllers: [PlayerController, ExpeditionController],
  providers: [
    PlayerCommandService,
    WorldService,
    PlayerGateway,
    { provide: HERO_SESSIONS, useValue: new HeroSessions() },
  ],
  exports: [PlayerCommandService, WorldService],
})
export class PlayerModule {}

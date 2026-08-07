import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './auth/jwt-auth.module';
import { ContentModule } from './content/content.module';
import { DbModule } from './db/db.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { HeroesModule } from './heroes/heroes.module';

@Module({
  imports: [
    DbModule,
    JwtAuthModule,
    AuthModule.forRoot(),
    ContentModule,
    GameModule,
    HeroesModule,
    HealthModule,
  ],
})
export class AppModule {}

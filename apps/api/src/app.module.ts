import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { DbModule } from './db/db.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DbModule, AuthModule, ContentModule, GameModule, HealthModule],
})
export class AppModule {}

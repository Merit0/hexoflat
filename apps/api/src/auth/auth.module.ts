import { type DynamicModule, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_THROTTLE_TTL_MS, getAuthThrottleLimit } from './auth-throttle.env';

@Module({})
export class AuthModule {
  static forRoot(loginThrottleLimit: number = getAuthThrottleLimit()): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ThrottlerModule.forRoot([{ ttl: AUTH_THROTTLE_TTL_MS, limit: loginThrottleLimit }]),
      ],
      controllers: [AuthController],
      providers: [AuthService],
    };
  }
}

import { Body, Controller, Inject, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { LoginDto, LoginDtoSchema, RegisterDto, RegisterDtoSchema } from './auth.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  // tsx/esbuild doesn't emit TS `design:paramtypes` metadata, so Nest can't
  // infer constructor injection by type alone — @Inject() gives it an
  // explicit token instead.
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginDtoSchema))
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterDtoSchema))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}

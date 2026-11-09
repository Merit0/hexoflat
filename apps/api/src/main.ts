import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { corsOptions } from './cors';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }),
  );
  await app.register(helmet);
  await app.register(cookie);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors(corsOptions());
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

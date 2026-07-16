import 'dotenv/config';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum di-set di .env');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Prefix /api/uploads (bukan /uploads) supaya lolos proxy vite '/api' di dev tanpa config tambahan.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/api/uploads' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  });
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();

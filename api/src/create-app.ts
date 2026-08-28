import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: corsOrigins(), credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lucky Reels API')
      .setDescription('Spin packs, checkout and the game')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}

function corsOrigins(): string[] | boolean {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (!configured) return false;
  if (configured === '*') return true;

  return configured.split(',').map((origin) => origin.trim());
}

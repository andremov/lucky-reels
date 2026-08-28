import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOrigins } from './shared/http/cors-origins';
import { toValidationEnvelope } from './shared/http/validation-envelope';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: corsOrigins(process.env.CORS_ORIGIN), credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: toValidationEnvelope,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Lucky Reels API')
      .setDescription('Spin packs, checkout and the game')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  // Swagger's assets are not served from a serverless bundle, so the page loads
  // and the UI never boots. They are copied into public/docs at build time and
  // served as static files from the same origin, which the default script tags
  // already point at and which Helmet's script-src 'self' allows.
  SwaggerModule.setup('docs', app, document);

  return app;
}

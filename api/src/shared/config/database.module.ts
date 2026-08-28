// TypeORM resolves its driver with a runtime require, which bundlers cannot
// trace. Importing it here keeps pg in the serverless bundle.
import 'pg';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolveDatabaseSsl } from './database-ssl';

export const DEFAULT_CA_PATH = join(process.cwd(), 'certs', 'supabase-ca.crt');

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: resolveDatabaseSsl({
          caCert: config.get<string>('DATABASE_CA_CERT'),
          caPath: config.get<string>('DATABASE_CA_PATH') ?? DEFAULT_CA_PATH,
          insecureOptOut: config.get<string>('DATABASE_SSL') === 'disable',
        }),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}

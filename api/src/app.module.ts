import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/config/database.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GameModule } from './game/game.module';
import { DeliveriesModule } from './deliveries/deliveries.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, HealthModule, ProductsModule, TransactionsModule, GameModule, DeliveriesModule],
})
export class AppModule {}

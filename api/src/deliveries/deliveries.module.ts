import { Module } from '@nestjs/common';
import { DeliveriesController } from './infrastructure/http/deliveries.controller';

@Module({ controllers: [DeliveriesController] })
export class DeliveriesModule {}

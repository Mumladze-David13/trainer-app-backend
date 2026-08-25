// src/subscription/subscription.module.ts
import { Module } from '@nestjs/common';
import { SubscriptionController, SubscriptionAdminController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  controllers: [SubscriptionController, SubscriptionAdminController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}

import { Module } from '@nestjs/common';
import { CouponsModule } from '@/modules/coupons/coupons.module';
import { JobsModule } from '@/modules/jobs/jobs.module';
import { OrdersController } from './orders.controller';
import { WebhooksController } from './webhooks.controller';
import { OrdersService } from './orders.service';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [CouponsModule, JobsModule],
  controllers: [OrdersController, WebhooksController],
  providers: [OrdersService, WebhooksService],
  exports: [OrdersService],
})
export class OrdersModule {}

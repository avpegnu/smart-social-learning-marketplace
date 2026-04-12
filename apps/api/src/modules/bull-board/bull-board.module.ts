import { Module } from '@nestjs/common';
import { BullBoardModule as NestBullBoard } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    NestBullBoard.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    NestBullBoard.forFeature({ name: 'email', adapter: BullMQAdapter }),
    NestBullBoard.forFeature({ name: 'notification', adapter: BullMQAdapter }),
    NestBullBoard.forFeature({ name: 'feed', adapter: BullMQAdapter }),
  ],
})
export class BullBoardModule {}

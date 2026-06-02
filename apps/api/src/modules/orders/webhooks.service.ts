import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import type { SepayWebhookDto } from './dto/sepay-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(OrderFulfillmentService) private readonly fulfillment: OrderFulfillmentService,
  ) {}

  async handleSepayWebhook(authorization: string, payload: SepayWebhookDto) {
    // 1. Verify API key — SePay sends "Apikey <key>" in Authorization header
    const webhookSecret = this.config.get<string>('sepay.webhookSecret');
    const apiKey = authorization?.replace(/^Apikey\s+/i, '') ?? '';
    if (apiKey !== webhookSecret) {
      throw new ForbiddenException({ code: 'INVALID_WEBHOOK_KEY' });
    }

    // 2. Only process incoming transfers
    if (payload.transferType !== 'in') return { success: true };

    // 3. Extract order code from content (format: SSLM20260321xxxxx)
    const orderCodeMatch = payload.content.match(/SSLM\d{13}/i);
    if (!orderCodeMatch) return { success: true };
    const orderCode = orderCodeMatch[0]!;

    // 4. Find pending order
    const order = await this.prisma.order.findFirst({
      where: { orderCode, status: 'PENDING' },
      include: { items: true },
    });
    if (!order) return { success: true };

    // 5. Verify amount
    if (payload.transferAmount < order.finalAmount) return { success: true };

    // 6. Complete order (enrollment, earnings, notifications, groups)
    await this.fulfillment.fulfillOrder(order.id, order.userId, order.items, payload.referenceCode);

    return { success: true };
  }
}

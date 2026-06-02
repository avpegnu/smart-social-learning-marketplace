import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  order: { findFirst: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'sepay.webhookSecret') return 'test-secret';
    return '';
  }),
};

const mockFulfillment = { fulfillOrder: jest.fn() };

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: OrderFulfillmentService, useValue: mockFulfillment },
      ],
    }).compile();

    service = module.get(WebhooksService);
    jest.clearAllMocks();
  });

  describe('handleSepayWebhook', () => {
    const validPayload = {
      gateway: 'MBBank',
      transactionDate: '2024-01-15',
      accountNumber: '0123456789',
      transferType: 'in',
      transferAmount: 499000,
      content: 'SSLM2026032100001 chuyen tien',
      referenceCode: 'FT24015',
    };

    it('should throw ForbiddenException for invalid API key', async () => {
      await expect(
        service.handleSepayWebhook('Apikey wrong-key', validPayload as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should ignore non-incoming transfers', async () => {
      const result = await service.handleSepayWebhook('Apikey test-secret', {
        ...validPayload,
        transferType: 'out',
      } as never);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
    });

    it('should ignore if no order code in content', async () => {
      const result = await service.handleSepayWebhook('Apikey test-secret', {
        ...validPayload,
        content: 'random transfer',
      } as never);

      expect(result).toEqual({ success: true });
    });

    it('should ignore if order not found or not PENDING', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const result = await service.handleSepayWebhook('Apikey test-secret', validPayload as never);

      expect(result).toEqual({ success: true });
      expect(mockFulfillment.fulfillOrder).not.toHaveBeenCalled();
    });

    it('should ignore if amount insufficient', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        finalAmount: 999000,
        userId: 'user-1',
        items: [],
      });

      const result = await service.handleSepayWebhook('Apikey test-secret', validPayload as never);

      expect(result).toEqual({ success: true });
      expect(mockFulfillment.fulfillOrder).not.toHaveBeenCalled();
    });

    it('should fulfill order when payment valid', async () => {
      const items = [
        { id: 'oi-1', type: 'COURSE', courseId: 'c1', chapterId: null, price: 499000, discount: 0 },
      ];
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        finalAmount: 499000,
        userId: 'user-1',
        items,
      });

      const result = await service.handleSepayWebhook('Apikey test-secret', validPayload as never);

      expect(result).toEqual({ success: true });
      expect(mockFulfillment.fulfillOrder).toHaveBeenCalledWith(
        'order-1',
        'user-1',
        items,
        'FT24015',
      );
    });
  });
});

import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  order: { findFirst: jest.fn(), update: jest.fn() },
  enrollment: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  chapterPurchase: { upsert: jest.fn() },
  course: { findUnique: jest.fn(), update: jest.fn() },
  earning: { create: jest.fn(), aggregate: jest.fn() },
  commissionTier: { findFirst: jest.fn() },
  $transaction: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'sepay.webhookSecret') return 'test-secret';
    return '';
  }),
};

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
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
      content: 'SSLM-abc12345 chuyen tien',
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
    });

    it('should complete order when payment valid', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        finalAmount: 499000,
        userId: 'user-1',
        items: [{ id: 'oi-1', type: 'COURSE', courseId: 'c1', chapterId: null, price: 499000 }],
      });

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { update: jest.fn() },
          enrollment: { upsert: jest.fn() },
          course: {
            findUnique: jest.fn().mockResolvedValue({ instructorId: 'instr-1' }),
            update: jest.fn(),
          },
          earning: {
            create: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
          },
          commissionTier: { findFirst: jest.fn().mockResolvedValue({ rate: 0.3 }) },
        }),
      );

      const result = await service.handleSepayWebhook('Apikey test-secret', validPayload as never);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});

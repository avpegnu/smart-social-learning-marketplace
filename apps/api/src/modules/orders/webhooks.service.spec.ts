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
  instructorProfile: { upsert: jest.fn() },
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
        items: [
          {
            id: 'oi-1',
            type: 'COURSE',
            courseId: 'c1',
            chapterId: null,
            price: 499000,
            discount: 0,
          },
        ],
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
          instructorProfile: { upsert: jest.fn() },
        }),
      );

      const result = await service.handleSepayWebhook('Apikey test-secret', validPayload as never);

      expect(result).toEqual({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should create earning with actualPrice = price - discount', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        finalAmount: 400000,
        userId: 'user-1',
        items: [
          {
            id: 'oi-1',
            type: 'COURSE',
            courseId: 'c1',
            chapterId: null,
            price: 500000,
            discount: 100000,
          },
        ],
      });

      const txEarningCreate = jest.fn();
      const txInstructorProfileUpsert = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { update: jest.fn() },
          enrollment: { upsert: jest.fn() },
          course: {
            findUnique: jest.fn().mockResolvedValue({ instructorId: 'instr-1' }),
            update: jest.fn(),
          },
          earning: {
            create: txEarningCreate,
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
          },
          commissionTier: { findFirst: jest.fn().mockResolvedValue({ rate: 0.3 }) },
          instructorProfile: { upsert: txInstructorProfileUpsert },
        }),
      );

      await service.handleSepayWebhook('Apikey test-secret', {
        ...validPayload,
        transferAmount: 400000,
      } as never);

      // actualPrice = 500000 - 100000 = 400000
      // commission = 400000 * 0.3 = 120000
      // netAmount = 400000 - 120000 = 280000
      expect(txEarningCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          instructorId: 'instr-1',
          amount: 400000,
          commissionRate: 0.3,
          commissionAmount: 120000,
          netAmount: 280000,
          status: 'PENDING',
        }),
      });

      // Should update instructor profile counters
      expect(txInstructorProfileUpsert).toHaveBeenCalledWith({
        where: { userId: 'instr-1' },
        update: expect.objectContaining({
          totalRevenue: { increment: 280000 },
        }),
        create: expect.objectContaining({
          userId: 'instr-1',
          totalRevenue: 280000,
        }),
      });
    });
  });
});

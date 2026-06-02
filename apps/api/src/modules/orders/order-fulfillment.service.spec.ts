import { Test } from '@nestjs/testing';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { PlatformSettingsService } from '@/modules/platform-settings/platform-settings.service';
import { GroupsService } from '@/modules/social/groups/groups.service';

const mockPrisma = {
  course: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockQueue = { addNotification: jest.fn() };

// Returns the provided fallback for any setting key
const mockPlatformSettings = { get: jest.fn((_key: string, fallback: unknown) => fallback) };

const mockGroups = { addMemberByCourseId: jest.fn() };

describe('OrderFulfillmentService', () => {
  let service: OrderFulfillmentService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderFulfillmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: PlatformSettingsService, useValue: mockPlatformSettings },
        { provide: GroupsService, useValue: mockGroups },
      ],
    }).compile();

    service = module.get(OrderFulfillmentService);
    jest.clearAllMocks();
  });

  describe('fulfillOrder', () => {
    it('should create earning with actualPrice = price - discount', async () => {
      const items = [
        {
          id: 'oi-1',
          type: 'COURSE',
          courseId: 'c1',
          chapterId: null,
          price: 500000,
          discount: 100000,
        },
      ];

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
      mockPrisma.course.findMany.mockResolvedValue([
        { id: 'c1', title: 'React', instructorId: 'instr-1' },
      ]);

      await service.fulfillOrder('order-1', 'user-1', items, 'FT123');

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

      // Buyer notified + added to course group
      expect(mockQueue.addNotification).toHaveBeenCalledWith('user-1', 'ORDER_COMPLETED', {
        orderId: 'order-1',
      });
      expect(mockGroups.addMemberByCourseId).toHaveBeenCalledWith('c1', 'user-1');
    });

    it('should enroll and create a zero earning for a fully-discounted (free) item', async () => {
      const items = [
        {
          id: 'oi-1',
          type: 'COURSE',
          courseId: 'c1',
          chapterId: null,
          price: 100000,
          discount: 100000,
        },
      ];

      const txEnrollUpsert = jest.fn();
      const txEarningCreate = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { update: jest.fn() },
          enrollment: { upsert: txEnrollUpsert },
          course: {
            findUnique: jest.fn().mockResolvedValue({ instructorId: 'instr-1' }),
            update: jest.fn(),
          },
          earning: {
            create: txEarningCreate,
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
          },
          commissionTier: { findFirst: jest.fn().mockResolvedValue({ rate: 0.3 }) },
          instructorProfile: { upsert: jest.fn() },
        }),
      );
      mockPrisma.course.findMany.mockResolvedValue([
        { id: 'c1', title: 'Free', instructorId: 'instr-1' },
      ]);

      await service.fulfillOrder('order-1', 'user-1', items, 'FREE');

      // Enrollment still granted
      expect(txEnrollUpsert).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 'user-1', courseId: 'c1' } },
        update: { type: 'FULL' },
        create: { userId: 'user-1', courseId: 'c1', type: 'FULL' },
      });
      // actualPrice = 0 -> zero earning
      expect(txEarningCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: 0, commissionAmount: 0, netAmount: 0 }),
      });
      expect(mockQueue.addNotification).toHaveBeenCalledWith('user-1', 'ORDER_COMPLETED', {
        orderId: 'order-1',
      });
    });
  });
});

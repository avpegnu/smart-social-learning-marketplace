import { Test } from '@nestjs/testing';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { PlatformSettingsService } from '@/modules/platform-settings/platform-settings.service';
import { GroupsService } from '@/modules/social/groups/groups.service';

const mockPrisma = {
  course: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockQueue = { addNotification: jest.fn(), addOrderReceiptEmail: jest.fn() };

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
          order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          enrollment: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
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
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'buyer@example.com' });

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

      // Paid order (400000 after discount) → buyer gets a receipt email
      expect(mockQueue.addOrderReceiptEmail).toHaveBeenCalledWith(
        'buyer@example.com',
        'order-1',
        400000,
      );
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
          order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          enrollment: { findUnique: jest.fn().mockResolvedValue(null), upsert: txEnrollUpsert },
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
      // Free/fully-discounted order (amount 0) → no receipt email
      expect(mockQueue.addOrderReceiptEmail).not.toHaveBeenCalled();
    });

    it('should not increment totalStudents when the user is already enrolled (PARTIAL->FULL)', async () => {
      const items = [
        { id: 'oi-1', type: 'COURSE', courseId: 'c1', chapterId: null, price: 500000, discount: 0 },
      ];
      const txCourseUpdate = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          enrollment: {
            findUnique: jest.fn().mockResolvedValue({ type: 'PARTIAL' }), // already enrolled
            upsert: jest.fn(),
          },
          course: {
            findUnique: jest.fn().mockResolvedValue({ instructorId: 'instr-1' }),
            update: txCourseUpdate,
          },
          earning: {
            create: jest.fn(),
            aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
          },
          commissionTier: { findFirst: jest.fn().mockResolvedValue({ rate: 0.3 }) },
          instructorProfile: { upsert: jest.fn() },
        }),
      );
      mockPrisma.course.findMany.mockResolvedValue([
        { id: 'c1', title: 'React', instructorId: 'instr-1' },
      ]);

      await service.fulfillOrder('order-1', 'user-1', items, 'FT123');

      // Upgrading an existing enrollment must not bump the course student counter.
      expect(txCourseUpdate).not.toHaveBeenCalled();
    });

    it('should be idempotent: skip all side effects when the order is no longer PENDING', async () => {
      const items = [
        { id: 'oi-1', type: 'COURSE', courseId: 'c1', chapterId: null, price: 500000, discount: 0 },
      ];
      const txEarningCreate = jest.fn();

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          // Guarded transition matches zero rows: already completed/expired elsewhere.
          order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          enrollment: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
          course: { findUnique: jest.fn(), update: jest.fn() },
          earning: { create: txEarningCreate, aggregate: jest.fn() },
          instructorProfile: { upsert: jest.fn() },
        }),
      );

      await service.fulfillOrder('order-1', 'user-1', items, 'FT123');

      expect(txEarningCreate).not.toHaveBeenCalled();
      expect(mockQueue.addNotification).not.toHaveBeenCalled();
      expect(mockGroups.addMemberByCourseId).not.toHaveBeenCalled();
      expect(mockQueue.addOrderReceiptEmail).not.toHaveBeenCalled();
    });
  });
});

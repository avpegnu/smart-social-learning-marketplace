import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  coupon: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  couponCourse: { deleteMany: jest.fn(), createMany: jest.fn() },
  couponUsage: { count: jest.fn() },
  course: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

const MOCK_COUPON = {
  id: 'coupon-1',
  code: 'REACT2024',
  type: 'PERCENTAGE',
  value: 20,
  usageLimit: 100,
  usageCount: 5,
  maxUsesPerUser: 1,
  minOrderAmount: 100000,
  maxDiscount: 200000,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2030-12-31'),
  isActive: true,
  instructorId: 'instr-1',
  couponCourses: [],
};

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CouponsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CouponsService);
    jest.clearAllMocks();
  });

  // ==================== INSTRUCTOR CRUD ====================

  describe('create', () => {
    it('should create coupon with valid data', async () => {
      mockPrisma.coupon.create.mockResolvedValue(MOCK_COUPON);

      const result = await service.create('instr-1', {
        code: 'REACT2024',
        type: 'PERCENTAGE' as never,
        value: 20,
        startsAt: '2024-01-01T00:00:00Z',
        expiresAt: '2025-12-31T23:59:59Z',
      } as never);

      expect(result).toBeDefined();
    });

    it('should reject invalid percentage value', async () => {
      await expect(
        service.create('instr-1', {
          code: 'BAD',
          type: 'PERCENTAGE' as never,
          value: 150,
          startsAt: '2024-01-01',
          expiresAt: '2025-12-31',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid date range', async () => {
      await expect(
        service.create('instr-1', {
          code: 'BAD',
          type: 'PERCENTAGE' as never,
          value: 20,
          startsAt: '2025-12-31',
          expiresAt: '2024-01-01',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('should soft delete coupon', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(MOCK_COUPON);
      mockPrisma.coupon.update.mockResolvedValue({ ...MOCK_COUPON, isActive: false });

      const result = await service.deactivate('coupon-1', 'instr-1');

      expect(result.isActive).toBe(false);
    });

    it('should throw if not coupon owner', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(MOCK_COUPON);

      await expect(service.deactivate('coupon-1', 'other-user')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== VALIDATION ====================

  describe('validateAndCalculateDiscount', () => {
    const cartItems = [{ courseId: 'c1', price: 500000 }];

    it('should calculate PERCENTAGE discount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(MOCK_COUPON);
      mockPrisma.couponUsage.count.mockResolvedValue(0);

      const result = await service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems);

      expect(result.discount).toBe(100000); // 500000 * 20%
    });

    it('should cap discount at maxDiscount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...MOCK_COUPON,
        value: 80,
        maxDiscount: 200000,
      });
      mockPrisma.couponUsage.count.mockResolvedValue(0);

      const result = await service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems);

      expect(result.discount).toBe(200000); // 500000 * 80% = 400000, capped at 200000
    });

    it('should calculate FIXED_AMOUNT discount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...MOCK_COUPON,
        type: 'FIXED_AMOUNT',
        value: 50000,
        maxDiscount: null,
      });
      mockPrisma.couponUsage.count.mockResolvedValue(0);

      const result = await service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems);

      expect(result.discount).toBe(50000);
    });

    it('should throw if coupon not found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.validateAndCalculateDiscount('BAD', 'user-1', cartItems),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if coupon expired', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...MOCK_COUPON,
        endDate: new Date('2020-01-01'),
      });

      await expect(
        service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if usage limit exceeded', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...MOCK_COUPON,
        usageCount: 100,
      });

      await expect(
        service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if per-user limit exceeded', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(MOCK_COUPON);
      mockPrisma.couponUsage.count.mockResolvedValue(1);

      await expect(
        service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if below minimum order amount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...MOCK_COUPON,
        minOrderAmount: 1000000,
      });
      mockPrisma.couponUsage.count.mockResolvedValue(0);

      await expect(
        service.validateAndCalculateDiscount('REACT2024', 'user-1', cartItems),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

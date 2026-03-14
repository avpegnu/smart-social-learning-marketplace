import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
  order: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  couponUsage: { create: jest.fn() },
  coupon: { update: jest.fn() },
  $transaction: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'sepay.bankId': 'MB',
      'sepay.bankAccountNumber': '0123456789',
      'sepay.bankAccountName': 'PLATFORM',
    };
    return config[key];
  }),
};

const mockCouponsService = {
  validateAndCalculateDiscount: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CouponsService, useValue: mockCouponsService },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should throw if cart is empty', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.createOrder('user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('should create order with payment info', async () => {
      const cartItems = [
        {
          id: 'ci-1',
          price: 499000,
          courseId: 'c1',
          chapterId: null,
          course: { title: 'React', status: 'PUBLISHED' },
          chapter: null,
        },
      ];
      mockPrisma.cartItem.findMany.mockResolvedValue(cartItems);

      const mockOrder = {
        id: 'order-1',
        orderCode: 'SSLM-test123',
        finalAmount: 499000,
        items: [],
      };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
          cartItem: { deleteMany: jest.fn() },
        }),
      );

      const result = await service.createOrder('user-1', {});

      expect(result.order).toBeDefined();
      expect(result.payment).toBeDefined();
      expect(result.payment.qrUrl).toContain('img.vietqr.io');
    });

    it('should apply coupon discount', async () => {
      const cartItems = [
        {
          id: 'ci-1',
          price: 499000,
          courseId: 'c1',
          chapterId: null,
          course: { title: 'React', status: 'PUBLISHED' },
          chapter: null,
        },
      ];
      mockPrisma.cartItem.findMany.mockResolvedValue(cartItems);
      mockCouponsService.validateAndCalculateDiscount.mockResolvedValue({
        couponId: 'coupon-1',
        discount: 99800,
      });

      const mockOrder = { id: 'order-1', orderCode: 'SSLM-test', finalAmount: 399200, items: [] };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
          couponUsage: { create: jest.fn() },
          coupon: { update: jest.fn() },
          cartItem: { deleteMany: jest.fn() },
        }),
      );

      const result = await service.createOrder('user-1', { couponCode: 'REACT2024' });

      expect(mockCouponsService.validateAndCalculateDiscount).toHaveBeenCalled();
      expect(result.order.finalAmount).toBe(399200);
    });

    it('should throw if course no longer available', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        {
          id: 'ci-1',
          price: 499000,
          courseId: 'c1',
          course: { title: 'React', status: 'ARCHIVED' },
        },
      ]);

      await expect(service.createOrder('user-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return order for owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-1', userId: 'user-1' });

      const result = await service.findById('order-1', 'user-1');

      expect(result).toBeDefined();
    });

    it('should throw if not owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'order-1', userId: 'other' });

      await expect(service.findById('order-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrderStatus', () => {
    it('should return status and paidAt', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        paidAt: new Date(),
        userId: 'user-1',
      });

      const result = await service.getOrderStatus('order-1', 'user-1');

      expect(result.status).toBe('COMPLETED');
      expect(result.paidAt).toBeDefined();
    });
  });
});

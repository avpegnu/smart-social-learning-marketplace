import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  cartItem: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  course: { findFirst: jest.fn() },
  chapter: { findUnique: jest.fn() },
  enrollment: { findUnique: jest.fn() },
  chapterPurchase: { findUnique: jest.fn() },
  wishlist: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
};

const MOCK_COURSE = {
  id: 'course-1',
  title: 'React',
  price: 499000,
  status: 'PUBLISHED',
  instructorId: 'instr-1',
  deletedAt: null,
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CartService);
    jest.clearAllMocks();
  });

  // ==================== CART ====================

  describe('getCart', () => {
    it('should return items with subtotal', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { id: 'item-1', price: 499000, courseId: 'c1', chapterId: null },
        { id: 'item-2', price: 79000, courseId: 'c2', chapterId: 'ch1' },
      ]);

      const result = await service.getCart('user-1');

      expect(result.items).toHaveLength(2);
      expect(result.subtotal).toBe(578000);
    });

    it('should return empty cart', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([]);

      const result = await service.getCart('user-1');

      expect(result.items).toHaveLength(0);
      expect(result.subtotal).toBe(0);
    });
  });

  describe('addItem', () => {
    it('should add full course to cart with price from DB', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);
      mockPrisma.cartItem.create.mockResolvedValue({ id: 'item-1', price: 499000 });

      const result = await service.addItem('user-1', { courseId: 'course-1' });

      expect(result.price).toBe(499000);
      expect(mockPrisma.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 499000 }),
        }),
      );
    });

    it('should throw if course not found', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.addItem('user-1', { courseId: 'bad' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if buying own course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);

      await expect(service.addItem('instr-1', { courseId: 'course-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if already fully enrolled', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });

      await expect(service.addItem('user-1', { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw if duplicate in cart', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.addItem('user-1', { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should add chapter with price from DB', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.chapter.findUnique.mockResolvedValue({ id: 'ch-1', price: 79000 });
      mockPrisma.chapterPurchase.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);
      mockPrisma.cartItem.create.mockResolvedValue({ id: 'item-1', price: 79000 });

      const result = await service.addItem('user-1', {
        courseId: 'course-1',
        chapterId: 'ch-1',
      });

      expect(result.price).toBe(79000);
    });

    it('should throw if chapter not purchasable (no price)', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.chapter.findUnique.mockResolvedValue({ id: 'ch-1', price: null });

      await expect(
        service.addItem('user-1', { courseId: 'course-1', chapterId: 'ch-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should replace chapter items when adding full course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.findMany.mockResolvedValue([{ id: 'ch-item', chapterId: 'ch-1' }]);
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);
      mockPrisma.cartItem.create.mockResolvedValue({ id: 'item-1' });

      await service.addItem('user-1', { courseId: 'course-1' });

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', courseId: 'course-1' },
      });
    });
  });

  describe('removeItem', () => {
    it('should remove item', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValue({ id: 'item-1', userId: 'user-1' });

      await service.removeItem('user-1', 'item-1');

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });

    it('should throw if item not found', async () => {
      mockPrisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(service.removeItem('user-1', 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    it('should delete all items for user', async () => {
      await service.clearCart('user-1');

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  // ==================== WISHLIST ====================

  describe('addToWishlist', () => {
    it('should add course to wishlist', async () => {
      mockPrisma.wishlist.findUnique.mockResolvedValue(null);
      mockPrisma.wishlist.create.mockResolvedValue({ id: 'w-1' });

      await service.addToWishlist('user-1', 'course-1');

      expect(mockPrisma.wishlist.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', courseId: 'course-1' },
      });
    });

    it('should throw if already in wishlist', async () => {
      mockPrisma.wishlist.findUnique.mockResolvedValue({ id: 'w-1' });

      await expect(service.addToWishlist('user-1', 'course-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('removeFromWishlist', () => {
    it('should remove from wishlist', async () => {
      await service.removeFromWishlist('user-1', 'course-1');

      expect(mockPrisma.wishlist.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', courseId: 'course-1' },
      });
    });
  });
});

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const MOCK_CATEGORY = {
  id: 'cat-1',
  name: 'Web Development',
  slug: 'web-development',
  iconUrl: null,
  parentId: null,
  order: 0,
  children: [],
  _count: { courses: 25 },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(CategoriesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return top-level categories with children and course counts', async () => {
      mockPrisma.category.findMany.mockResolvedValue([MOCK_CATEGORY]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Web Development');
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: null },
          orderBy: { order: 'asc' },
        }),
      );
    });

    it('should return empty array when no categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(MOCK_CATEGORY);

      const result = await service.findBySlug('web-development');

      expect(result.name).toBe('Web Development');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

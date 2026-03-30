import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { AdminContentService } from './admin-content.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AdminContentService', () => {
  let service: AdminContentService;
  const prisma = {
    category: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    course: { count: jest.fn() },
    courseTag: { count: jest.fn() },
    commissionTier: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    platformSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminContentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminContentService);
    jest.clearAllMocks();
  });

  // --- Categories ---

  describe('createCategory', () => {
    it('should create a category with generated slug', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat1',
        name: 'Web Development',
        slug: 'web-development',
      });

      const result = await service.createCategory({
        name: 'Web Development',
      });
      expect(result.slug).toBe('web-development');
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Web Development',
          slug: 'web-development',
        }),
      });
    });

    it('should throw if slug already exists', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createCategory({ name: 'Web Development' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateCategory', () => {
    it('should regenerate slug when name changes', async () => {
      prisma.category.update.mockResolvedValue({
        id: 'cat1',
        name: 'Mobile Dev',
        slug: 'mobile-dev',
      });

      await service.updateCategory('cat1', { name: 'Mobile Dev' });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat1' },
        data: expect.objectContaining({ slug: 'mobile-dev' }),
      });
    });

    it('should not regenerate slug when name not provided', async () => {
      prisma.category.update.mockResolvedValue({
        id: 'cat1',
        description: 'Updated',
      });

      await service.updateCategory('cat1', {
        description: 'Updated',
      });

      const data = prisma.category.update.mock.calls[0]![0]!.data;
      expect(data.slug).toBeUndefined();
    });
  });

  describe('deleteCategory', () => {
    it('should delete category with no courses', async () => {
      prisma.course.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue({ id: 'cat1' });

      await service.deleteCategory('cat1');
      expect(prisma.category.delete).toHaveBeenCalled();
    });

    it('should throw if category has courses', async () => {
      prisma.course.count.mockResolvedValue(5);

      await expect(service.deleteCategory('cat1')).rejects.toThrow(BadRequestException);
    });
  });

  // --- Tags ---

  describe('getTags', () => {
    it('should return paginated tags with course count', async () => {
      const tags = [
        { id: 'tag1', name: 'React', slug: 'react', _count: { courseTags: 5 } },
        { id: 'tag2', name: 'TypeScript', slug: 'typescript', _count: { courseTags: 3 } },
      ];
      prisma.tag.findMany.mockResolvedValue(tags);
      prisma.tag.count.mockResolvedValue(2);

      const result = await service.getTags({ page: 1, limit: 20 });

      expect(result.data).toEqual(tags);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by search term', async () => {
      prisma.tag.findMany.mockResolvedValue([]);
      prisma.tag.count.mockResolvedValue(0);

      await service.getTags({ page: 1, limit: 20, search: 'react' });

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'react', mode: 'insensitive' } },
        }),
      );
    });

    it('should use default pagination when not provided', async () => {
      prisma.tag.findMany.mockResolvedValue([]);
      prisma.tag.count.mockResolvedValue(0);

      await service.getTags({});

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('createTag', () => {
    it('should create a tag with slug', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue({
        id: 'tag1',
        name: 'React',
        slug: 'react',
      });

      const result = await service.createTag({ name: 'React' });
      expect(result.name).toBe('React');
    });

    it('should throw if slug exists', async () => {
      prisma.tag.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createTag({ name: 'React' })).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteTag', () => {
    it('should delete tag with no courses', async () => {
      prisma.courseTag.count.mockResolvedValue(0);
      prisma.tag.delete.mockResolvedValue({ id: 'tag1' });

      await service.deleteTag('tag1');
      expect(prisma.tag.delete).toHaveBeenCalled();
    });

    it('should throw if tag has courses', async () => {
      prisma.courseTag.count.mockResolvedValue(3);

      await expect(service.deleteTag('tag1')).rejects.toThrow(BadRequestException);
    });
  });

  // --- Commission Tiers ---

  describe('getCommissionTiers', () => {
    it('should return tiers sorted by minRevenue', async () => {
      const tiers = [
        { id: 't1', minRevenue: 0, rate: 0.3 },
        { id: 't2', minRevenue: 10000000, rate: 0.25 },
      ];
      prisma.commissionTier.findMany.mockResolvedValue(tiers);

      const result = await service.getCommissionTiers();
      expect(result).toEqual(tiers);
      expect(prisma.commissionTier.findMany).toHaveBeenCalledWith({
        orderBy: { minRevenue: 'asc' },
      });
    });
  });

  describe('createCommissionTier', () => {
    it('should create a commission tier', async () => {
      prisma.commissionTier.create.mockResolvedValue({
        id: 't1',
        minRevenue: 50000000,
        rate: 0.2,
      });

      const result = await service.createCommissionTier({
        minRevenue: 50000000,
        rate: 0.2,
      });
      expect(result.rate).toBe(0.2);
    });
  });

  // --- Platform Settings ---

  describe('getSettings', () => {
    it('should return all settings', async () => {
      const settings = [{ key: 'minWithdrawal', value: 200000 }];
      prisma.platformSetting.findMany.mockResolvedValue(settings);

      const result = await service.getSettings();
      expect(result).toEqual(settings);
    });
  });

  describe('updateSetting', () => {
    it('should upsert a setting', async () => {
      prisma.platformSetting.upsert.mockResolvedValue({
        key: 'minWithdrawal',
        value: 500000,
      });

      const result = await service.updateSetting({
        key: 'minWithdrawal',
        value: 500000,
      });
      expect(result.value).toBe(500000);
      expect(prisma.platformSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'minWithdrawal' },
        }),
      );
    });
  });
});

import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { CourseSortBy } from '../dto/query-courses.dto';

const mockPrisma = {
  course: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
};

const MOCK_COURSE = {
  id: 'course-1',
  title: 'React Masterclass',
  slug: 'react-masterclass-abc123',
  shortDescription: 'Learn React',
  thumbnailUrl: null,
  level: 'INTERMEDIATE',
  language: 'vi',
  price: 499000,
  originalPrice: null,
  avgRating: 4.7,
  reviewCount: 100,
  totalStudents: 500,
  totalLessons: 48,
  totalDuration: 45000,
  publishedAt: new Date('2024-01-01'),
  status: 'PUBLISHED',
  deletedAt: null,
  instructor: { id: 'instr-1', fullName: 'Teacher', avatarUrl: null },
  category: { id: 'cat-1', name: 'Web Dev', slug: 'web-dev' },
  courseTags: [],
  sections: [],
  reviews: [],
};

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(CoursesService);
    jest.clearAllMocks();
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should return paginated courses', async () => {
      mockPrisma.course.findMany.mockResolvedValue([MOCK_COURSE]);
      mockPrisma.course.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0 } as never);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED', deletedAt: null }),
        }),
      );
    });

    it('should filter by categorySlug', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        categorySlug: 'web-dev',
      } as never);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { slug: 'web-dev' },
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        minPrice: 100000,
        maxPrice: 500000,
      } as never);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { gte: 100000, lte: 500000 },
          }),
        }),
      );
    });

    it('should filter by search term', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        search: 'react',
      } as never);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'react', mode: 'insensitive' } },
              { shortDescription: { contains: 'react', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should sort by popular', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        sort: CourseSortBy.POPULAR,
      } as never);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalStudents: 'desc' },
        }),
      );
    });

    it('should filter by level and language', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        level: 'INTERMEDIATE',
        language: 'vi',
      } as never);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            level: 'INTERMEDIATE',
            language: 'vi',
          }),
        }),
      );
    });
  });

  // ==================== findBySlug ====================

  describe('findBySlug', () => {
    it('should return course and track view', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.findBySlug('react-masterclass-abc123');

      expect(result).toEqual(MOCK_COURSE);
      expect(mockRedis.set).toHaveBeenCalledWith('viewed:course-1:anon', '1', 'EX', 3600);
      expect(mockRedis.incr).toHaveBeenCalledWith('course_views:course-1');
    });

    it('should skip view tracking if already viewed', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockRedis.get.mockResolvedValue('1');

      await service.findBySlug('react-masterclass-abc123', 'user-1');

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should use userId for view dedup when authenticated', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(MOCK_COURSE);
      mockRedis.get.mockResolvedValue(null);

      await service.findBySlug('react-masterclass-abc123', 'user-1');

      expect(mockRedis.get).toHaveBeenCalledWith('viewed:course-1:user-1');
    });

    it('should throw NotFoundException for non-existent course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});

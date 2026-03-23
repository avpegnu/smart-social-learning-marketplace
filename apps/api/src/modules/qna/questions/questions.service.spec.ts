import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

const mockPrisma = {
  question: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  answer: { findUnique: jest.fn() },
};

const mockRedis = {
  sadd: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  expire: jest.fn().mockResolvedValue(1),
};

describe('QuestionsService', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get(QuestionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a question', async () => {
      const question = { id: 'q1', title: 'How to use useEffect?' };
      mockPrisma.question.create.mockResolvedValue(question);

      const result = await service.create('user-1', {
        title: 'How to use useEffect?',
        content: 'I want to understand useEffect hook in React 18...',
      } as never);
      expect(result.title).toBe('How to use useEffect?');
    });
  });

  describe('findAll', () => {
    it('should return paginated questions', async () => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q1', bestAnswerId: null },
        { id: 'q2', bestAnswerId: 'a1' },
      ]);
      mockPrisma.question.count.mockResolvedValue(2);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
      } as never);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.hasBestAnswer).toBe(false);
      expect(result.data[1]!.hasBestAnswer).toBe(true);
    });

    it('should filter by courseId', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        courseId: 'course-1',
      } as never);
      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ courseId: 'course-1' }),
        }),
      );
    });

    it('should filter answered questions', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        skip: 0,
        status: 'answered',
      } as never);
      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bestAnswerId: { not: null },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return question with answers', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        answers: [{ id: 'a1' }],
      });
      mockPrisma.question.update.mockResolvedValue({});

      const result = await service.findById('q1');
      expect(result.answers).toHaveLength(1);
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'user-1',
      });
      mockPrisma.question.update.mockResolvedValue({
        id: 'q1',
        title: 'Updated',
      });

      const result = await service.update('q1', 'user-1', {
        title: 'Updated',
      } as never);
      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'other',
      });
      await expect(service.update('q1', 'user-1', { title: 'x' } as never)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('delete', () => {
    it('should delete question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'user-1',
      });
      mockPrisma.question.delete.mockResolvedValue({ id: 'q1' });

      await service.delete('q1', 'user-1');
      expect(mockPrisma.question.delete).toHaveBeenCalled();
    });
  });

  describe('markBestAnswer', () => {
    it('should mark best answer by question owner', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'user-1',
        course: null,
      });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        questionId: 'q1',
      });
      mockPrisma.question.update.mockResolvedValue({
        id: 'q1',
        bestAnswerId: 'a1',
      });

      const result = await service.markBestAnswer('q1', 'a1', 'user-1');
      expect(result.bestAnswerId).toBe('a1');
    });

    it('should mark best answer by course instructor', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'student-1',
        course: { instructorId: 'instructor-1' },
      });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        questionId: 'q1',
      });
      mockPrisma.question.update.mockResolvedValue({
        id: 'q1',
        bestAnswerId: 'a1',
      });

      const result = await service.markBestAnswer('q1', 'a1', 'instructor-1');
      expect(result.bestAnswerId).toBe('a1');
    });

    it('should throw ForbiddenException if not owner/instructor', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'owner',
        course: { instructorId: 'instructor' },
      });
      await expect(service.markBestAnswer('q1', 'a1', 'random-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if answer not for question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        authorId: 'user-1',
        course: null,
      });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        questionId: 'q2',
      });
      await expect(service.markBestAnswer('q1', 'a1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

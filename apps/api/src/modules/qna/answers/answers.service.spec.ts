import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AnswersService } from './answers.service';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';

const mockPrisma = {
  question: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  answer: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  vote: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockNotifications = { create: jest.fn().mockResolvedValue({}) };

describe('AnswersService', () => {
  let service: AnswersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AnswersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(AnswersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create answer and increment counter', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ id: 'q1', authorId: 'other-user' });
      const answer = { id: 'a1', content: 'Because of StrictMode...' };
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.answer.create.mockResolvedValue(answer);
      mockPrisma.question.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ fullName: 'Test User' });

      const result = await service.create('user-1', 'q1', {
        content: 'Because of StrictMode...',
      } as never);
      expect(result.content).toBe('Because of StrictMode...');
    });

    it('should throw NotFoundException for missing question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', 'bad', { content: 'x' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete answer and decrement counter', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'user-1',
        questionId: 'q1',
      });
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => unknown) =>
        cb(mockPrisma),
      );
      mockPrisma.question.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.answer.delete.mockResolvedValue({});
      mockPrisma.question.update.mockResolvedValue({});

      await service.delete('a1', 'user-1');
      expect(mockPrisma.answer.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'other',
      });
      await expect(service.delete('a1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('vote', () => {
    it('should create new upvote', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'author',
        voteCount: 5,
      });
      mockPrisma.vote.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.vote('user-1', 'a1', 1);
      expect(result).toEqual({ voteCount: 6, userVote: 1 });
    });

    it('should create new downvote', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'author',
        voteCount: 5,
      });
      mockPrisma.vote.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.vote('user-1', 'a1', -1);
      expect(result).toEqual({ voteCount: 4, userVote: -1 });
    });

    it('should toggle off same vote', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'author',
        voteCount: 5,
      });
      mockPrisma.vote.findUnique.mockResolvedValue({
        id: 'v1',
        value: 1,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.vote('user-1', 'a1', 1);
      expect(result).toEqual({ voteCount: 4, userVote: null });
    });

    it('should change vote direction', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'author',
        voteCount: 5,
      });
      mockPrisma.vote.findUnique.mockResolvedValue({
        id: 'v1',
        value: 1,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.vote('user-1', 'a1', -1);
      expect(result).toEqual({ voteCount: 3, userVote: -1 });
    });

    it('should remove vote with value=0', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'author',
        voteCount: 5,
      });
      mockPrisma.vote.findUnique.mockResolvedValue({
        id: 'v1',
        value: 1,
      });
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.vote('user-1', 'a1', 0);
      expect(result).toEqual({ voteCount: 4, userVote: null });
    });

    it('should throw BadRequestException for own answer', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'a1',
        authorId: 'user-1',
      });
      await expect(service.vote('user-1', 'a1', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing answer', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue(null);
      await expect(service.vote('user-1', 'bad', 1)).rejects.toThrow(NotFoundException);
    });
  });
});

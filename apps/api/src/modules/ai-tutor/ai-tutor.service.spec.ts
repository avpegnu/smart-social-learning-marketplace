import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiTutorService } from './ai-tutor.service';
import { EmbeddingsService } from './embeddings/embeddings.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

const mockPrisma = {
  enrollment: { findFirst: jest.fn() },
  aiChatSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  aiChatMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockRedis = {
  checkRateLimit: jest.fn(),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('test-value'),
  getOrThrow: jest.fn().mockReturnValue('test-api-key'),
};

const mockEmbeddings = {
  generateEmbedding: jest.fn(),
  isReady: jest.fn().mockReturnValue(false),
};

// Mock groq-sdk
jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'AI response here' } }],
          }),
        },
      },
    })),
  };
});

describe('AiTutorService', () => {
  let service: AiTutorService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiTutorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmbeddingsService, useValue: mockEmbeddings },
      ],
    }).compile();

    service = module.get(AiTutorService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('askQuestion', () => {
    it('should throw AI_DAILY_LIMIT_REACHED when rate limited', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(false);

      await expect(
        service.askQuestion('user-1', {
          courseId: 'c1',
          question: 'What is React?',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ENROLLMENT_REQUIRED when not enrolled', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(true);
      mockPrisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.askQuestion('user-1', {
          courseId: 'c1',
          question: 'What is React?',
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create new session and return answer', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(true);
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockPrisma.aiChatSession.create.mockResolvedValue({
        id: 'session-1',
        title: 'What is React?',
      });
      mockEmbeddings.generateEmbedding.mockRejectedValue(new Error('not loaded'));
      mockPrisma.aiChatMessage.findMany.mockResolvedValue([]);
      mockPrisma.aiChatMessage.create
        .mockResolvedValueOnce({ id: 'msg-user' })
        .mockResolvedValueOnce({ id: 'msg-ai' });
      mockPrisma.aiChatSession.update.mockResolvedValue({});

      const result = await service.askQuestion('user-1', {
        courseId: 'c1',
        question: 'What is React?',
      } as never);

      expect(result.answer).toBe('AI response here');
      expect(result.sessionId).toBe('session-1');
      expect(result.messageId).toBe('msg-ai');
    });

    it('should use existing session when sessionId provided', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(true);
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockPrisma.aiChatSession.findUnique.mockResolvedValue({
        id: 'existing-session',
        userId: 'user-1',
      });
      mockEmbeddings.generateEmbedding.mockRejectedValue(new Error('not loaded'));
      mockPrisma.aiChatMessage.findMany.mockResolvedValue([
        { role: 'USER', content: 'Previous question' },
        { role: 'ASSISTANT', content: 'Previous answer' },
      ]);
      mockPrisma.aiChatMessage.create
        .mockResolvedValueOnce({ id: 'msg-user' })
        .mockResolvedValueOnce({ id: 'msg-ai' });

      const result = await service.askQuestion('user-1', {
        courseId: 'c1',
        sessionId: 'existing-session',
        question: 'Follow up question',
      } as never);

      expect(result.sessionId).toBe('existing-session');
    });

    it('should throw if session not owned by user', async () => {
      mockRedis.checkRateLimit.mockResolvedValue(true);
      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: 'e1' });
      mockPrisma.aiChatSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'other-user',
      });

      await expect(
        service.askQuestion('user-1', {
          courseId: 'c1',
          sessionId: 's1',
          question: 'test',
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSessions', () => {
    it('should return sessions with message count', async () => {
      mockPrisma.aiChatSession.findMany.mockResolvedValue([{ id: 's1', _count: { messages: 5 } }]);

      const result = await service.getSessions('user-1');
      expect(result).toHaveLength(1);
    });

    it('should filter by courseId', async () => {
      mockPrisma.aiChatSession.findMany.mockResolvedValue([]);

      await service.getSessions('user-1', 'course-1');
      expect(mockPrisma.aiChatSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ courseId: 'course-1' }),
        }),
      );
    });
  });

  describe('getSessionMessages', () => {
    it('should return ordered messages', async () => {
      mockPrisma.aiChatSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
      });
      mockPrisma.aiChatMessage.findMany.mockResolvedValue([
        { id: 'm1', role: 'USER' },
        { id: 'm2', role: 'ASSISTANT' },
      ]);

      const result = await service.getSessionMessages('s1', 'user-1');
      expect(result).toHaveLength(2);
    });

    it('should throw if not session owner', async () => {
      mockPrisma.aiChatSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'other',
      });

      await expect(service.getSessionMessages('s1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});

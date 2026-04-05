import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { QuestionBanksService } from './question-banks.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('QuestionBanksService', () => {
  let service: QuestionBanksService;
  const prisma = {
    questionBank: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    questionBankItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    questionBankOption: {
      deleteMany: jest.fn(),
    },
    questionBankTag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [QuestionBanksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(QuestionBanksService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a question bank', async () => {
      const dto = { name: 'JS Basics', description: 'JavaScript fundamentals' };
      prisma.questionBank.create.mockResolvedValue({ id: 'qb1', ...dto, instructorId: 'inst1' });

      const result = await service.create('inst1', dto);

      expect(result.name).toBe('JS Basics');
      expect(prisma.questionBank.create).toHaveBeenCalledWith({
        data: { ...dto, instructorId: 'inst1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated banks for instructor', async () => {
      prisma.questionBank.findMany.mockResolvedValue([{ id: 'qb1', name: 'Bank 1' }]);
      prisma.questionBank.count.mockResolvedValue(1);

      const result = await service.findAll('inst1', { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should filter by search term', async () => {
      prisma.questionBank.findMany.mockResolvedValue([]);
      prisma.questionBank.count.mockResolvedValue(0);

      await service.findAll('inst1', { search: 'react' });

      expect(prisma.questionBank.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'react', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return bank with questions and tags', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({
        id: 'qb1',
        instructorId: 'inst1',
        questions: [],
        tags: [{ id: 't1', name: 'Chapter 1' }],
      });

      const result = await service.findById('qb1', 'inst1');
      expect(result.id).toBe('qb1');
      expect(result.tags).toHaveLength(1);
    });

    it('should include tags in the query', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({
        id: 'qb1',
        instructorId: 'inst1',
        questions: [],
        tags: [],
      });

      await service.findById('qb1', 'inst1');
      expect(prisma.questionBank.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            tags: { orderBy: { name: 'asc' } },
          }),
        }),
      );
    });

    it('should throw if not found', async () => {
      prisma.questionBank.findUnique.mockResolvedValue(null);
      await expect(service.findById('qb1', 'inst1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if not owner', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({
        id: 'qb1',
        instructorId: 'other',
      });
      await expect(service.findById('qb1', 'inst1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update bank name', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBank.update.mockResolvedValue({ id: 'qb1', name: 'Updated' });

      const result = await service.update('qb1', 'inst1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('should delete bank', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBank.delete.mockResolvedValue({});

      await service.delete('qb1', 'inst1');
      expect(prisma.questionBank.delete).toHaveBeenCalledWith({ where: { id: 'qb1' } });
    });

    it('should throw if not owner', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'other' });
      await expect(service.delete('qb1', 'inst1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addQuestion', () => {
    it('should add question with difficulty and tagIds', async () => {
      const dto = {
        question: 'What is JS?',
        explanation: 'JavaScript',
        difficulty: 'INTERMEDIATE' as const,
        tagIds: ['tag1', 'tag2'],
        options: [
          { text: 'A language', isCorrect: true },
          { text: 'A framework', isCorrect: false },
        ],
      };

      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankItem.findFirst.mockResolvedValue(null);

      const tx = {
        questionBankItem: { create: jest.fn().mockResolvedValue({ id: 'q1', ...dto }) },
        questionBank: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn) => fn(tx));

      await service.addQuestion('qb1', 'inst1', dto);

      expect(tx.questionBankItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            difficulty: 'INTERMEDIATE',
            tagIds: ['tag1', 'tag2'],
          }),
        }),
      );
      expect(tx.questionBank.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { questionCount: { increment: 1 } },
        }),
      );
    });

    it('should default difficulty to null and tagIds to [] when not provided', async () => {
      const dto = {
        question: 'What is JS?',
        options: [
          { text: 'A language', isCorrect: true },
          { text: 'A framework', isCorrect: false },
        ],
      };

      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankItem.findFirst.mockResolvedValue(null);

      const tx = {
        questionBankItem: { create: jest.fn().mockResolvedValue({ id: 'q1' }) },
        questionBank: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn) => fn(tx));

      await service.addQuestion('qb1', 'inst1', dto);

      expect(tx.questionBankItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            difficulty: null,
            tagIds: [],
          }),
        }),
      );
    });

    it('should reject if no correct option', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });

      const badDto = {
        question: 'Test?',
        options: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: false },
        ],
      };

      await expect(service.addQuestion('qb1', 'inst1', badDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if multiple correct options', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });

      const badDto = {
        question: 'Test?',
        options: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: true },
        ],
      };

      await expect(service.addQuestion('qb1', 'inst1', badDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addQuestionsBatch', () => {
    it('should add multiple questions with difficulty and tagIds', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankItem.findFirst.mockResolvedValue(null);

      const questions = [
        {
          question: 'Q1?',
          difficulty: 'BEGINNER' as const,
          tagIds: ['tag1'],
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
        {
          question: 'Q2?',
          difficulty: 'ADVANCED' as const,
          tagIds: ['tag2'],
          options: [
            { text: 'C', isCorrect: false },
            { text: 'D', isCorrect: true },
          ],
        },
      ];

      const tx = {
        questionBankItem: { create: jest.fn().mockResolvedValue({ id: 'q1' }) },
        questionBank: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn) => fn(tx));

      await service.addQuestionsBatch('qb1', 'inst1', questions);

      expect(tx.questionBankItem.create).toHaveBeenCalledTimes(2);
      expect(tx.questionBankItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            difficulty: 'BEGINNER',
            tagIds: ['tag1'],
          }),
        }),
      );
      expect(tx.questionBank.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { questionCount: { increment: 2 } },
        }),
      );
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question and decrement count', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankItem.findFirst.mockResolvedValue({ id: 'q1' });
      prisma.$transaction.mockResolvedValue([]);

      await service.deleteQuestion('qb1', 'q1', 'inst1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw if question not found', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankItem.findFirst.mockResolvedValue(null);

      await expect(service.deleteQuestion('qb1', 'q1', 'inst1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Bank Tags ──

  describe('getTags', () => {
    it('should return tags for bank', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.findMany.mockResolvedValue([
        { id: 't1', bankId: 'qb1', name: 'Chapter 1' },
        { id: 't2', bankId: 'qb1', name: 'Chapter 2' },
      ]);

      const result = await service.getTags('qb1', 'inst1');
      expect(result).toHaveLength(2);
      expect(prisma.questionBankTag.findMany).toHaveBeenCalledWith({
        where: { bankId: 'qb1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createTag', () => {
    it('should create a tag', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.create.mockResolvedValue({
        id: 't1',
        bankId: 'qb1',
        name: 'Chapter 1',
      });

      const result = await service.createTag('qb1', 'inst1', { name: 'Chapter 1' });
      expect(result.name).toBe('Chapter 1');
      expect(prisma.questionBankTag.create).toHaveBeenCalledWith({
        data: { bankId: 'qb1', name: 'Chapter 1' },
      });
    });

    it('should throw if not bank owner', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'other' });
      await expect(service.createTag('qb1', 'inst1', { name: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateTag', () => {
    it('should update tag name', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.findFirst.mockResolvedValue({ id: 't1', bankId: 'qb1', name: 'Old' });
      prisma.questionBankTag.update.mockResolvedValue({ id: 't1', name: 'New Name' });

      const result = await service.updateTag('qb1', 't1', 'inst1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should throw if tag not found', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.findFirst.mockResolvedValue(null);

      await expect(service.updateTag('qb1', 't1', 'inst1', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteTag', () => {
    it('should delete tag and clean up tagIds on questions', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.findFirst.mockResolvedValue({ id: 't1' });
      prisma.$transaction.mockResolvedValue([]);

      await service.deleteTag('qb1', 't1', 'inst1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw if tag not found', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'inst1' });
      prisma.questionBankTag.findFirst.mockResolvedValue(null);

      await expect(service.deleteTag('qb1', 't1', 'inst1')).rejects.toThrow(NotFoundException);
    });

    it('should throw if not bank owner', async () => {
      prisma.questionBank.findUnique.mockResolvedValue({ instructorId: 'other' });
      await expect(service.deleteTag('qb1', 't1', 'inst1')).rejects.toThrow(ForbiddenException);
    });
  });
});

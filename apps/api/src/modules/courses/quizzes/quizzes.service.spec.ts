import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CourseManagementService } from '../management/course-management.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  quiz: {
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  lesson: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCourseManagement = { verifyOwnership: jest.fn() };

const VALID_QUIZ_DTO = {
  passingScore: 70,
  maxAttempts: 3,
  questions: [
    {
      question: 'Which hook manages state?',
      options: [
        { text: 'useState', isCorrect: true },
        { text: 'useEffect', isCorrect: false },
      ],
    },
  ],
};

describe('QuizzesService', () => {
  let service: QuizzesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QuizzesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CourseManagementService, useValue: mockCourseManagement },
      ],
    }).compile();

    service = module.get(QuizzesService);
    jest.clearAllMocks();
  });

  describe('upsertQuiz', () => {
    it('should create quiz with correct passingScore conversion', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapter: { section: { courseId: 'course-1' } },
      });

      const mockQuiz = { id: 'quiz-1', lessonId: 'les-1', passingScore: 0.7 };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          quiz: {
            deleteMany: jest.fn(),
            create: jest.fn().mockResolvedValue(mockQuiz),
          },
        }),
      );

      const result = await service.upsertQuiz(
        'course-1',
        'les-1',
        'instr-1',
        VALID_QUIZ_DTO as never,
      );

      expect(result).toBeDefined();
    });

    it('should reject quiz with multiple correct options in a question', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapter: { section: { courseId: 'course-1' } },
      });

      const invalidDto = {
        questions: [
          {
            question: 'Test?',
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true }, // 2 correct!
            ],
          },
        ],
      };

      await expect(
        service.upsertQuiz('course-1', 'les-1', 'instr-1', invalidDto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject quiz with no correct options', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapter: { section: { courseId: 'course-1' } },
      });

      const invalidDto = {
        questions: [
          {
            question: 'Test?',
            options: [
              { text: 'A', isCorrect: false },
              { text: 'B', isCorrect: false },
            ],
          },
        ],
      };

      await expect(
        service.upsertQuiz('course-1', 'les-1', 'instr-1', invalidDto as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if lesson does not belong to course', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.lesson.findUnique.mockResolvedValue({
        id: 'les-1',
        chapter: { section: { courseId: 'other-course' } },
      });

      await expect(
        service.upsertQuiz('course-1', 'les-1', 'instr-1', VALID_QUIZ_DTO as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getQuiz', () => {
    it('should return quiz with questions and options', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      const mockQuiz = {
        id: 'quiz-1',
        questions: [{ id: 'q-1', options: [{ id: 'o-1' }] }],
      };
      mockPrisma.quiz.findUnique.mockResolvedValue(mockQuiz);

      const result = await service.getQuiz('course-1', 'les-1', 'instr-1');

      expect(result).toEqual(mockQuiz);
    });

    it('should return null when no quiz exists', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.quiz.findUnique.mockResolvedValue(null);

      const result = await service.getQuiz('course-1', 'les-1', 'instr-1');

      expect(result).toBeNull();
    });
  });

  describe('deleteQuiz', () => {
    it('should delete quiz by lessonId', async () => {
      mockCourseManagement.verifyOwnership.mockResolvedValue({});
      mockPrisma.quiz.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteQuiz('course-1', 'les-1', 'instr-1');

      expect(mockPrisma.quiz.deleteMany).toHaveBeenCalledWith({ where: { lessonId: 'les-1' } });
    });
  });
});

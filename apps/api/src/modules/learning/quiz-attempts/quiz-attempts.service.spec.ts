import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';
import { ProgressService } from '../progress/progress.service';
import { StreaksService } from '../streaks/streaks.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  quiz: { findUnique: jest.fn() },
  enrollment: { findUnique: jest.fn() },
  quizAttempt: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  lessonProgress: { upsert: jest.fn() },
};

const mockProgress = { recalculateEnrollmentProgress: jest.fn() };
const mockStreaks = { trackDailyActivity: jest.fn() };

const MOCK_QUIZ = {
  id: 'quiz-1',
  lessonId: 'les-1',
  passingScore: 0.7,
  maxAttempts: 3,
  questions: [
    {
      id: 'q-1',
      explanation: 'useState manages state',
      options: [
        { id: 'opt-a', text: 'useState', isCorrect: true },
        { id: 'opt-b', text: 'useEffect', isCorrect: false },
      ],
    },
    {
      id: 'q-2',
      explanation: null,
      options: [
        { id: 'opt-c', text: 'True', isCorrect: true },
        { id: 'opt-d', text: 'False', isCorrect: false },
      ],
    },
  ],
  lesson: { chapter: { section: { courseId: 'course-1' } } },
};

describe('QuizAttemptsService', () => {
  let service: QuizAttemptsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProgressService, useValue: mockProgress },
        { provide: StreaksService, useValue: mockStreaks },
      ],
    }).compile();

    service = module.get(QuizAttemptsService);
    jest.clearAllMocks();
  });

  describe('submitQuiz', () => {
    it('should grade quiz and return results', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(MOCK_QUIZ);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.5 });
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      mockPrisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });
      mockPrisma.lessonProgress.upsert.mockResolvedValue({});
      mockProgress.recalculateEnrollmentProgress.mockResolvedValue(0.6);

      const result = await service.submitQuiz('user-1', 'les-1', {
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-a' }, // correct
          { questionId: 'q-2', selectedOptionId: 'opt-c' }, // correct
        ],
      });

      expect(result.correctCount).toBe(2);
      expect(result.totalQuestions).toBe(2);
      expect(result.attempt.score).toBe(100); // 0-100 format
      expect(result.attempt.passed).toBe(true);
      expect(result.lessonCompleted).toBe(true);
    });

    it('should fail quiz below passing score', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(MOCK_QUIZ);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0.5 });
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      mockPrisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      const result = await service.submitQuiz('user-1', 'les-1', {
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-b' }, // wrong
          { questionId: 'q-2', selectedOptionId: 'opt-d' }, // wrong
        ],
      });

      expect(result.correctCount).toBe(0);
      expect(result.attempt.passed).toBe(false);
      expect(result.lessonCompleted).toBe(false);
      expect(mockPrisma.lessonProgress.upsert).not.toHaveBeenCalled();
    });

    it('should throw if quiz not found', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(null);

      await expect(service.submitQuiz('user-1', 'les-1', { answers: [] })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if not enrolled', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(MOCK_QUIZ);
      mockPrisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(service.submitQuiz('user-1', 'les-1', { answers: [] })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if max attempts reached', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(MOCK_QUIZ);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL' });
      mockPrisma.quizAttempt.count.mockResolvedValue(3); // maxAttempts = 3

      await expect(service.submitQuiz('user-1', 'les-1', { answers: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return explanations and correct answers', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue(MOCK_QUIZ);
      mockPrisma.enrollment.findUnique.mockResolvedValue({ type: 'FULL', progress: 0 });
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      mockPrisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1' });

      const result = await service.submitQuiz('user-1', 'les-1', {
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-b' },
          { questionId: 'q-2', selectedOptionId: 'opt-c' },
        ],
      });

      expect(result.results[0]!.correctAnswer).toBe('opt-a');
      expect(result.results[0]!.explanation).toBe('useState manages state');
    });
  });

  describe('getAttempts', () => {
    it('should return attempts for quiz', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValue({ id: 'quiz-1' });
      mockPrisma.quizAttempt.findMany.mockResolvedValue([{ id: 'att-1' }]);

      const result = await service.getAttempts('user-1', 'les-1');

      expect(result).toHaveLength(1);
    });
  });
});

import { Test } from '@nestjs/testing';
import { PlacementTestsService } from './placement-tests.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  placementQuestion: { findMany: jest.fn(), findUnique: jest.fn() },
  placementTest: { create: jest.fn(), upsert: jest.fn() },
  category: { findUnique: jest.fn() },
  course: { findMany: jest.fn() },
};

function makeQuestions(
  level: string,
  count: number,
  startIdx = 0,
): Array<{ id: string; question: string; options: unknown[]; level: string; answer: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `pq-${level.toLowerCase()}-${startIdx + i}`,
    question: `Q${startIdx + i}`,
    options: [{ id: 'a', text: 'A' }],
    level,
    answer: 'a',
  }));
}

describe('PlacementTestsService', () => {
  let service: PlacementTestsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PlacementTestsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(PlacementTestsService);
    jest.clearAllMocks();
  });

  describe('startTest', () => {
    it('should return questions without answers', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        courses: [{ courseTags: [{ tagId: 'tag-1' }] }],
      });
      mockPrisma.placementQuestion.findMany.mockResolvedValue([
        { id: 'pq-1', question: 'Q1', options: [], level: 'BEGINNER', answer: 'opt-a' },
        { id: 'pq-2', question: 'Q2', options: [], level: 'INTERMEDIATE', answer: 'opt-b' },
      ]);

      const result = await service.startTest('cat-1');

      expect(result.totalQuestions).toBe(2);
      expect(result.questions[0]).not.toHaveProperty('answer');
    });

    it('should return balanced 5/5/5 when enough questions per level', async () => {
      const allQuestions = [
        ...makeQuestions('BEGINNER', 8),
        ...makeQuestions('INTERMEDIATE', 8),
        ...makeQuestions('ADVANCED', 8),
      ];
      mockPrisma.placementQuestion.findMany.mockResolvedValue(allQuestions);

      const result = await service.startTest('');

      expect(result.totalQuestions).toBe(15);

      const levels = result.questions.map((q) => q.level);
      expect(levels.filter((l) => l === 'BEGINNER').length).toBe(5);
      expect(levels.filter((l) => l === 'INTERMEDIATE').length).toBe(5);
      expect(levels.filter((l) => l === 'ADVANCED').length).toBe(5);
    });

    it('should fill from leftover when a level has fewer than 5', async () => {
      const allQuestions = [
        ...makeQuestions('BEGINNER', 2),
        ...makeQuestions('INTERMEDIATE', 10),
        ...makeQuestions('ADVANCED', 10),
      ];
      mockPrisma.placementQuestion.findMany.mockResolvedValue(allQuestions);

      const result = await service.startTest('');

      expect(result.totalQuestions).toBe(15);
      const levels = result.questions.map((q) => q.level);
      expect(levels.filter((l) => l === 'BEGINNER').length).toBe(2);
      // Remaining 13 filled from INTERMEDIATE + ADVANCED
      expect(
        levels.filter((l) => l === 'INTERMEDIATE').length +
          levels.filter((l) => l === 'ADVANCED').length,
      ).toBe(13);
    });

    it('should return all questions when total is less than 15', async () => {
      const allQuestions = [
        ...makeQuestions('BEGINNER', 3),
        ...makeQuestions('INTERMEDIATE', 3),
        ...makeQuestions('ADVANCED', 3),
      ];
      mockPrisma.placementQuestion.findMany.mockResolvedValue(allQuestions);

      const result = await service.startTest('');

      expect(result.totalQuestions).toBe(9);
    });

    it('should filter by category tags when categoryId provided', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        courses: [
          { courseTags: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }] },
          { courseTags: [{ tagId: 'tag-2' }, { tagId: 'tag-3' }] },
        ],
      });
      mockPrisma.placementQuestion.findMany.mockResolvedValue([]);

      await service.startTest('cat-1');

      // First call: findMany() — all questions
      // Second call: findMany({ where: { tagIds: { hasSome } } })
      expect(mockPrisma.placementQuestion.findMany).toHaveBeenCalledWith({
        where: { tagIds: { hasSome: ['tag-1', 'tag-2', 'tag-3'] } },
      });
    });
  });

  describe('submitTest', () => {
    it('should grade and recommend BEGINNER level', async () => {
      mockPrisma.placementQuestion.findUnique
        .mockResolvedValueOnce({ id: 'pq-1', level: 'BEGINNER', answer: 'opt-a' })
        .mockResolvedValueOnce({ id: 'pq-2', level: 'BEGINNER', answer: 'opt-b' })
        .mockResolvedValueOnce({ id: 'pq-3', level: 'INTERMEDIATE', answer: 'opt-c' });
      mockPrisma.placementTest.upsert.mockResolvedValue({ id: 'test-1' });
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.submitTest('user-1', {
        answers: [
          { questionId: 'pq-1', selectedOptionId: 'opt-a' }, // correct BEGINNER
          { questionId: 'pq-2', selectedOptionId: 'opt-b' }, // correct BEGINNER
          { questionId: 'pq-3', selectedOptionId: 'opt-wrong' }, // wrong INTERMEDIATE
        ],
      });

      expect(result.level).toBe('BEGINNER');
      expect(result.scores['BEGINNER']).toBe(2);
    });

    it('should recommend ADVANCED when advanced score >= 70%', async () => {
      mockPrisma.placementQuestion.findUnique
        .mockResolvedValueOnce({ id: 'pq-1', level: 'ADVANCED', answer: 'opt-a' })
        .mockResolvedValueOnce({ id: 'pq-2', level: 'ADVANCED', answer: 'opt-b' });
      mockPrisma.placementTest.upsert.mockResolvedValue({ id: 'test-1' });
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.submitTest('user-1', {
        answers: [
          { questionId: 'pq-1', selectedOptionId: 'opt-a' },
          { questionId: 'pq-2', selectedOptionId: 'opt-b' },
        ],
      });

      expect(result.level).toBe('ADVANCED');
    });

    it('should upsert (not create) placement test result', async () => {
      mockPrisma.placementQuestion.findUnique.mockResolvedValue({
        id: 'pq-1',
        level: 'BEGINNER',
        answer: 'opt-a',
      });
      mockPrisma.placementTest.upsert.mockResolvedValue({ id: 'test-1' });
      mockPrisma.course.findMany.mockResolvedValue([]);

      await service.submitTest('user-1', {
        answers: [{ questionId: 'pq-1', selectedOptionId: 'opt-a' }],
      });

      expect(mockPrisma.placementTest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: expect.objectContaining({ recommendedLevel: 'BEGINNER' }),
          create: expect.objectContaining({ userId: 'user-1', recommendedLevel: 'BEGINNER' }),
        }),
      );
      expect(mockPrisma.placementTest.create).not.toHaveBeenCalled();
    });
  });
});

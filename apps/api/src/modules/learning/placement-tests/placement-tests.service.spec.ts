import { Test } from '@nestjs/testing';
import { PlacementTestsService } from './placement-tests.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  placementQuestion: { findMany: jest.fn(), findUnique: jest.fn() },
  placementTest: { create: jest.fn() },
  category: { findUnique: jest.fn() },
  course: { findMany: jest.fn() },
};

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
    it('should return shuffled questions without answers', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        courses: [{ courseTags: [{ tagId: 'tag-1' }] }],
      });
      mockPrisma.placementQuestion.findMany.mockResolvedValue([
        { id: 'pq-1', question: 'Q1', options: [], level: 'BEGINNER', answer: 'opt-a' },
        { id: 'pq-2', question: 'Q2', options: [], level: 'INTERMEDIATE', answer: 'opt-b' },
      ]);

      const result = await service.startTest('cat-1');

      expect(result.totalQuestions).toBe(2);
      // Answer field should NOT be in response
      expect(result.questions[0]).not.toHaveProperty('answer');
    });
  });

  describe('submitTest', () => {
    it('should grade and recommend level', async () => {
      mockPrisma.placementQuestion.findUnique
        .mockResolvedValueOnce({ id: 'pq-1', level: 'BEGINNER', answer: 'opt-a' })
        .mockResolvedValueOnce({ id: 'pq-2', level: 'BEGINNER', answer: 'opt-b' })
        .mockResolvedValueOnce({ id: 'pq-3', level: 'INTERMEDIATE', answer: 'opt-c' });
      mockPrisma.placementTest.create.mockResolvedValue({ id: 'test-1' });
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.submitTest('user-1', {
        answers: [
          { questionId: 'pq-1', selectedOptionId: 'opt-a' }, // correct BEGINNER
          { questionId: 'pq-2', selectedOptionId: 'opt-b' }, // correct BEGINNER
          { questionId: 'pq-3', selectedOptionId: 'opt-wrong' }, // wrong INTERMEDIATE
        ],
      });

      expect(result.level).toBe('BEGINNER'); // 100% beginner, 0% intermediate
      expect(result.scores['BEGINNER']).toBe(2);
    });

    it('should recommend ADVANCED when advanced score high', async () => {
      mockPrisma.placementQuestion.findUnique
        .mockResolvedValueOnce({ id: 'pq-1', level: 'ADVANCED', answer: 'opt-a' })
        .mockResolvedValueOnce({ id: 'pq-2', level: 'ADVANCED', answer: 'opt-b' });
      mockPrisma.placementTest.create.mockResolvedValue({ id: 'test-1' });
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.submitTest('user-1', {
        answers: [
          { questionId: 'pq-1', selectedOptionId: 'opt-a' },
          { questionId: 'pq-2', selectedOptionId: 'opt-b' },
        ],
      });

      expect(result.level).toBe('ADVANCED');
    });
  });
});

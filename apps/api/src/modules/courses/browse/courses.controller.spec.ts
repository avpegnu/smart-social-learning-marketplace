import { Test } from '@nestjs/testing';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

const mockCoursesService = {
  findAll: jest.fn(),
  findBySlug: jest.fn(),
};

describe('CoursesController', () => {
  let controller: CoursesController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: mockCoursesService }],
    }).compile();

    controller = module.get(CoursesController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should delegate to service with query params', async () => {
      const query = { page: 1, limit: 20, search: 'react' };
      const mockResult = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      mockCoursesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query as never);

      expect(result).toEqual(mockResult);
      expect(mockCoursesService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findBySlug', () => {
    it('should pass slug and userId to service', async () => {
      const mockCourse = { id: 'course-1', title: 'React' };
      mockCoursesService.findBySlug.mockResolvedValue(mockCourse);

      const result = await controller.findBySlug('react-abc', { sub: 'user-1' } as never);

      expect(result).toEqual(mockCourse);
      expect(mockCoursesService.findBySlug).toHaveBeenCalledWith('react-abc', 'user-1');
    });

    it('should pass undefined userId when not authenticated', async () => {
      mockCoursesService.findBySlug.mockResolvedValue({ id: 'course-1' });

      await controller.findBySlug('react-abc', undefined);

      expect(mockCoursesService.findBySlug).toHaveBeenCalledWith('react-abc', undefined);
    });
  });
});

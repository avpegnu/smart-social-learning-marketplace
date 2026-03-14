import { Test } from '@nestjs/testing';
import { CourseManagementController } from './course-management.controller';
import { CourseManagementService } from './course-management.service';

const mockService = {
  getInstructorCourses: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  submitForReview: jest.fn(),
  updateTags: jest.fn(),
};

const MOCK_USER = { sub: 'instr-1', email: 'test@test.com', role: 'INSTRUCTOR' };

describe('CourseManagementController', () => {
  let controller: CourseManagementController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CourseManagementController],
      providers: [{ provide: CourseManagementService, useValue: mockService }],
    }).compile();

    controller = module.get(CourseManagementController);
    jest.clearAllMocks();
  });

  it('should list instructor courses', async () => {
    mockService.getInstructorCourses.mockResolvedValue({ data: [], meta: {} });

    await controller.getInstructorCourses(MOCK_USER as never, {} as never);

    expect(mockService.getInstructorCourses).toHaveBeenCalledWith('instr-1', {});
  });

  it('should create course', async () => {
    const dto = { title: 'New Course' };
    mockService.create.mockResolvedValue({ id: 'course-1' });

    await controller.create(MOCK_USER as never, dto as never);

    expect(mockService.create).toHaveBeenCalledWith('instr-1', dto);
  });

  it('should update course', async () => {
    const dto = { title: 'Updated' };
    mockService.update.mockResolvedValue({ id: 'course-1' });

    await controller.update(MOCK_USER as never, 'course-1', dto as never);

    expect(mockService.update).toHaveBeenCalledWith('course-1', 'instr-1', dto);
  });

  it('should soft delete course', async () => {
    mockService.softDelete.mockResolvedValue({});

    await controller.delete(MOCK_USER as never, 'course-1');

    expect(mockService.softDelete).toHaveBeenCalledWith('course-1', 'instr-1');
  });

  it('should submit course for review', async () => {
    mockService.submitForReview.mockResolvedValue({});

    await controller.submitForReview(MOCK_USER as never, 'course-1');

    expect(mockService.submitForReview).toHaveBeenCalledWith('course-1', 'instr-1');
  });

  it('should update course tags', async () => {
    mockService.updateTags.mockResolvedValue({});

    await controller.updateTags(MOCK_USER as never, 'course-1', {
      tagIds: ['t1', 't2'],
    } as never);

    expect(mockService.updateTags).toHaveBeenCalledWith('course-1', 'instr-1', ['t1', 't2']);
  });
});

import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const mockService = {
  findByCourse: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const MOCK_USER = { sub: 'user-1', email: 'test@test.com', role: 'STUDENT' };

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockService }],
    }).compile();

    controller = module.get(ReviewsController);
    jest.clearAllMocks();
  });

  it('should get course reviews', async () => {
    mockService.findByCourse.mockResolvedValue({ data: [], meta: {} });

    await controller.findByCourse('course-1', {} as never);

    expect(mockService.findByCourse).toHaveBeenCalledWith('course-1', {});
  });

  it('should create review', async () => {
    const dto = { rating: 5, comment: 'Great!' };
    mockService.create.mockResolvedValue({ id: 'rev-1' });

    await controller.create(MOCK_USER as never, 'course-1', dto as never);

    expect(mockService.create).toHaveBeenCalledWith('user-1', 'course-1', dto);
  });

  it('should update review', async () => {
    const dto = { rating: 4 };
    mockService.update.mockResolvedValue({ id: 'rev-1' });

    await controller.update(MOCK_USER as never, 'rev-1', dto as never);

    expect(mockService.update).toHaveBeenCalledWith('user-1', 'rev-1', dto);
  });

  it('should delete review', async () => {
    mockService.delete.mockResolvedValue(undefined);

    await controller.delete(MOCK_USER as never, 'rev-1');

    expect(mockService.delete).toHaveBeenCalledWith('user-1', 'rev-1');
  });
});

import { Test } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

const mockService = {
  findAll: jest.fn(),
  findBySlug: jest.fn(),
};

describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get(CategoriesController);
    jest.clearAllMocks();
  });

  it('should get all categories', async () => {
    mockService.findAll.mockResolvedValue([{ name: 'Web Dev' }]);

    const result = await controller.findAll();

    expect(result).toHaveLength(1);
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('should get category by slug', async () => {
    mockService.findBySlug.mockResolvedValue({ name: 'Web Dev', slug: 'web-dev' });

    const result = await controller.findBySlug('web-dev');

    expect(result.slug).toBe('web-dev');
    expect(mockService.findBySlug).toHaveBeenCalledWith('web-dev');
  });
});

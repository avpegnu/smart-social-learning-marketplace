import { Test } from '@nestjs/testing';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { RolesGuard } from '@/common/guards/roles.guard';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';

const mockInstructorService = {
  submitApplication: jest.fn(),
  getApplicationStatus: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  getDashboard: jest.fn(),
};

const MOCK_STUDENT: JwtPayload = { sub: 'user-1', role: 'STUDENT' };
const MOCK_INSTRUCTOR: JwtPayload = { sub: 'user-2', role: 'INSTRUCTOR' };

describe('InstructorController', () => {
  let controller: InstructorController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InstructorController],
      providers: [{ provide: InstructorService, useValue: mockInstructorService }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InstructorController);
    jest.clearAllMocks();
  });

  // ==================== submitApplication ====================

  describe('submitApplication', () => {
    it('should call service.submitApplication with userId and dto', async () => {
      const dto = { expertise: ['React'], experience: 'A'.repeat(50) } as never;
      const created = { id: 'app-1', status: 'PENDING' };
      mockInstructorService.submitApplication.mockResolvedValue(created);

      const result = await controller.submitApplication(MOCK_STUDENT, dto);

      expect(result).toEqual(created);
      expect(mockInstructorService.submitApplication).toHaveBeenCalledWith('user-1', dto);
    });
  });

  // ==================== getApplicationStatus ====================

  describe('getApplicationStatus', () => {
    it('should call service.getApplicationStatus with userId', async () => {
      const applications = [{ id: 'app-1', status: 'PENDING' }];
      mockInstructorService.getApplicationStatus.mockResolvedValue(applications);

      const result = await controller.getApplicationStatus(MOCK_STUDENT);

      expect(result).toEqual(applications);
      expect(mockInstructorService.getApplicationStatus).toHaveBeenCalledWith('user-1');
    });
  });

  // ==================== getProfile ====================

  describe('getProfile', () => {
    it('should call service.getProfile with userId', async () => {
      const profile = { id: 'profile-1', headline: 'Senior Dev' };
      mockInstructorService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile(MOCK_INSTRUCTOR);

      expect(result).toEqual(profile);
      expect(mockInstructorService.getProfile).toHaveBeenCalledWith('user-2');
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    it('should call service.updateProfile with userId and dto', async () => {
      const dto = { headline: 'Updated Headline' } as never;
      const updated = { id: 'profile-1', headline: 'Updated Headline' };
      mockInstructorService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile(MOCK_INSTRUCTOR, dto);

      expect(result).toEqual(updated);
      expect(mockInstructorService.updateProfile).toHaveBeenCalledWith('user-2', dto);
    });
  });

  // ==================== getDashboard ====================

  describe('getDashboard', () => {
    it('should call service.getDashboard with userId', async () => {
      const dashboard = {
        overview: { totalRevenue: 5000000 },
        recentEarnings: [],
        courseStats: [],
      };
      mockInstructorService.getDashboard.mockResolvedValue(dashboard);

      const result = await controller.getDashboard(MOCK_INSTRUCTOR);

      expect(result).toEqual(dashboard);
      expect(mockInstructorService.getDashboard).toHaveBeenCalledWith('user-2');
    });
  });
});

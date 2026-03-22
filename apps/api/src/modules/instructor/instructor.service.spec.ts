import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InstructorService } from './instructor.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  instructorApplication: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  instructorProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  course: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  earning: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
};

const MOCK_APPLICATION_DTO = {
  expertise: ['React', 'Node.js'],
  experience: 'A'.repeat(50), // MinLength(50)
  motivation: 'Want to teach',
};

describe('InstructorService', () => {
  let service: InstructorService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [InstructorService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(InstructorService);
    jest.clearAllMocks();
  });

  // ==================== submitApplication ====================

  describe('submitApplication', () => {
    it('should create application successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockPrisma.instructorApplication.findFirst.mockResolvedValue(null);
      const created = { id: 'app-1', userId: 'user-1', ...MOCK_APPLICATION_DTO, status: 'PENDING' };
      mockPrisma.instructorApplication.create.mockResolvedValue(created);

      const result = await service.submitApplication('user-1', MOCK_APPLICATION_DTO);

      expect(result).toEqual(created);
      expect(mockPrisma.instructorApplication.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', ...MOCK_APPLICATION_DTO },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.submitApplication('nonexistent', MOCK_APPLICATION_DTO);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'USER_NOT_FOUND' });
      }
    });

    it('should throw BadRequestException if already instructor', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'INSTRUCTOR' });

      try {
        await service.submitApplication('user-1', MOCK_APPLICATION_DTO);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'ALREADY_INSTRUCTOR' });
      }
    });

    it('should throw BadRequestException if application already pending', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockPrisma.instructorApplication.findFirst.mockResolvedValue({
        id: 'app-1',
        status: 'PENDING',
      });

      try {
        await service.submitApplication('user-1', MOCK_APPLICATION_DTO);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toMatchObject({ code: 'APPLICATION_ALREADY_PENDING' });
      }
    });
  });

  // ==================== getApplicationStatus ====================

  describe('getApplicationStatus', () => {
    it('should return applications ordered by createdAt desc', async () => {
      const applications = [
        { id: 'app-2', status: 'REJECTED', createdAt: new Date('2024-02-01') },
        { id: 'app-1', status: 'PENDING', createdAt: new Date('2024-01-01') },
      ];
      mockPrisma.instructorApplication.findMany.mockResolvedValue(applications);

      const result = await service.getApplicationStatus('user-1');

      expect(result).toEqual(applications);
      expect(mockPrisma.instructorApplication.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  // ==================== getProfile ====================

  describe('getProfile', () => {
    it('should return instructor profile with user info', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-1',
        headline: 'Senior Dev',
        user: { fullName: 'Test', email: 'test@example.com', avatarUrl: null },
      };
      mockPrisma.instructorProfile.findUnique.mockResolvedValue(profile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(profile);
      expect(mockPrisma.instructorProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          user: { select: { fullName: true, email: true, avatarUrl: true } },
        },
      });
    });

    it('should throw NotFoundException if profile not found', async () => {
      mockPrisma.instructorProfile.findUnique.mockResolvedValue(null);

      try {
        await service.getProfile('user-1');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const response = (error as NotFoundException).getResponse();
        expect(response).toMatchObject({ code: 'INSTRUCTOR_PROFILE_NOT_FOUND' });
      }
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    it('should upsert instructor profile', async () => {
      const dto = { headline: 'New Headline', biography: 'New bio' };
      const upserted = { id: 'profile-1', userId: 'user-1', ...dto };
      mockPrisma.instructorProfile.upsert.mockResolvedValue(upserted);

      const result = await service.updateProfile('user-1', dto);

      expect(result).toEqual(upserted);
      expect(mockPrisma.instructorProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: expect.objectContaining({ headline: 'New Headline', biography: 'New bio' }),
        create: expect.objectContaining({
          userId: 'user-1',
          headline: 'New Headline',
          biography: 'New bio',
        }),
      });
    });

    it('should handle qualifications and socialLinks as JSON', async () => {
      const dto = {
        qualifications: [{ name: 'AWS', institution: 'Amazon', year: '2023' }],
        socialLinks: { github: 'https://github.com/test' },
      };
      mockPrisma.instructorProfile.upsert.mockResolvedValue({ id: 'profile-1' });

      await service.updateProfile('user-1', dto);

      expect(mockPrisma.instructorProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            qualifications: dto.qualifications,
            socialLinks: dto.socialLinks,
          }),
        }),
      );
    });
  });

  // ==================== getDashboard ====================

  describe('getDashboard', () => {
    it('should return dashboard with overview, recentEarnings, and courseStats', async () => {
      mockPrisma.instructorProfile.findUnique.mockResolvedValue({
        totalStudents: 100,
        totalCourses: 5,
        totalRevenue: 5000000,
        availableBalance: 3000000,
      });
      mockPrisma.course.count.mockResolvedValue(5);
      mockPrisma.earning.aggregate.mockResolvedValue({ _sum: { netAmount: 2000000 } }); // pending
      mockPrisma.earning.findMany.mockResolvedValue([]);
      mockPrisma.course.findMany.mockResolvedValue([
        { id: 'c1', title: 'React', totalStudents: 50, avgRating: 4.5 },
      ]);

      const result = await service.getDashboard('user-1');

      expect(result.overview).toEqual({
        totalRevenue: 5000000,
        totalStudents: 100,
        totalCourses: 5,
        availableBalance: 3000000,
        pendingBalance: 2000000,
      });
      expect(result.recentEarnings).toEqual([]);
      expect(result.courseStats).toHaveLength(1);
      expect(result.courseStats[0]).toMatchObject({ id: 'c1', title: 'React' });
    });

    it('should return zeros when profile does not exist', async () => {
      mockPrisma.instructorProfile.findUnique.mockResolvedValue(null);
      mockPrisma.course.count.mockResolvedValue(0);
      mockPrisma.earning.aggregate.mockResolvedValue({ _sum: { netAmount: null } });
      mockPrisma.earning.findMany.mockResolvedValue([]);
      mockPrisma.course.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('user-1');

      expect(result.overview).toEqual({
        totalRevenue: 0,
        totalStudents: 0,
        totalCourses: 0,
        availableBalance: 0,
        pendingBalance: 0,
      });
    });
  });
});

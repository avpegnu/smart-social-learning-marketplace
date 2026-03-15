import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewApplicationDto } from '../dto/review-application.dto';

@Injectable()
export class AdminApplicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPendingApplications(query: PaginationDto) {
    const where = { status: 'PENDING' as const };

    const [applications, total] = await Promise.all([
      this.prisma.instructorApplication.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.instructorApplication.count({ where }),
    ]);

    return createPaginatedResult(applications, total, query.page, query.limit);
  }

  async reviewApplication(applicationId: string, adminId: string, dto: ReviewApplicationDto) {
    const application = await this.prisma.instructorApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException({ code: 'APPLICATION_NOT_FOUND' });
    }
    if (application.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'APPLICATION_ALREADY_REVIEWED',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.instructorApplication.update({
        where: { id: applicationId },
        data: {
          status: dto.approved ? 'APPROVED' : 'REJECTED',
          reviewedById: adminId,
          reviewNote: dto.reviewNote,
          reviewedAt: new Date(),
        },
      });

      if (dto.approved) {
        await tx.user.update({
          where: { id: application.userId },
          data: { role: 'INSTRUCTOR' },
        });

        await tx.instructorProfile.upsert({
          where: { userId: application.userId },
          update: { expertise: application.expertise },
          create: {
            userId: application.userId,
            expertise: application.expertise,
            experience: application.experience,
          },
        });
      }

      return updated;
    });
  }
}

import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingsService } from '@/modules/ai-tutor/embeddings/embeddings.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewCourseDto } from '../dto/review-course.dto';

@Injectable()
export class AdminCoursesService {
  private readonly logger = new Logger(AdminCoursesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmbeddingsService) private readonly embeddingsService: EmbeddingsService,
  ) {}

  async getAllCourses(query: PaginationDto) {
    const where = { deletedAt: null, status: { not: 'DRAFT' as const } };

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          instructor: { select: { id: true, fullName: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  async getCourseDetail(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        courseTags: { include: { tag: true } },
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        sections: {
          orderBy: { order: 'asc' },
          include: {
            chapters: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    order: true,
                    textContent: true,
                    videoUrl: true,
                    estimatedDuration: true,
                    chapterId: true,
                    quiz: {
                      select: {
                        id: true,
                        passingScore: true,
                        maxAttempts: true,
                        timeLimitSeconds: true,
                        questions: {
                          orderBy: { order: 'asc' },
                          select: {
                            id: true,
                            question: true,
                            explanation: true,
                            order: true,
                            options: {
                              orderBy: { order: 'asc' },
                              select: {
                                id: true,
                                text: true,
                                isCorrect: true,
                                order: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course || course.deletedAt) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    return course;
  }

  async getPendingCourses(query: PaginationDto) {
    const where = {
      status: 'PENDING_REVIEW' as const,
      deletedAt: null,
    };

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: {
          instructor: {
            select: { id: true, fullName: true },
          },
          category: {
            select: { id: true, name: true },
          },
          _count: { select: { sections: true } },
        },
        orderBy: { updatedAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  async reviewCourse(courseId: string, _adminId: string, dto: ReviewCourseDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }
    if (course.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        code: 'COURSE_NOT_PENDING_REVIEW',
      });
    }

    if (dto.approved) {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.course.update({
          where: { id: courseId },
          data: {
            status: 'PUBLISHED',
            publishedAt: course.publishedAt ?? new Date(),
          },
        });

        // Auto-create private course group
        await tx.group.create({
          data: {
            name: updated.title,
            description: `Discussion group for ${updated.title}`,
            courseId: updated.id,
            ownerId: course.instructorId,
            privacy: 'PRIVATE',
          },
        });

        return updated;
      });

      // Index course content for AI Tutor (fire-and-forget)
      this.embeddingsService.indexCourseContent(courseId).catch((err: Error) => {
        this.logger.warn(`Failed to index course ${courseId} for AI Tutor: ${err.message}`);
      });

      return result;
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'REJECTED' },
    });
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QueueService } from '@/modules/jobs/queue.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { generateSlug, generateUniqueSlug } from '@/common/utils/slug.util';
import type { QueryCoursesDto } from '../dto/query-courses.dto';
import type { CreateCourseDto } from '../dto/create-course.dto';
import type { UpdateCourseDto } from '../dto/update-course.dto';
import type { QueryCourseStudentsDto } from './dto/query-course-students.dto';

@Injectable()
export class CourseManagementService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  // ==================== CRUD ====================

  async create(instructorId: string, dto: CreateCourseDto) {
    const { tags, tagIds, learningOutcomes, prerequisites, ...courseData } = dto;
    const slug = generateUniqueSlug(dto.title);

    // tagIds takes priority over tag names
    const tagLinks = tagIds?.length
      ? tagIds.map((id) => ({ tagId: id }))
      : tags?.length
        ? await this.findOrCreateTags(tags)
        : [];

    return this.prisma.course.create({
      data: {
        ...courseData,
        slug,
        instructorId,
        ...(learningOutcomes && {
          learningOutcomes: learningOutcomes as unknown as Prisma.InputJsonValue,
        }),
        ...(prerequisites && { prerequisites: prerequisites as unknown as Prisma.InputJsonValue }),
        ...(tagLinks.length > 0 && {
          courseTags: {
            create: tagLinks,
          },
        }),
      },
      include: {
        category: true,
        courseTags: { include: { tag: true } },
      },
    });
  }

  async update(courseId: string, instructorId: string, dto: UpdateCourseDto) {
    const course = await this.verifyOwnership(courseId, instructorId);

    // Only block editing when PENDING_REVIEW (admin is reviewing)
    if (course.status === 'PENDING_REVIEW') {
      throw new BadRequestException({ code: 'COURSE_NOT_EDITABLE' });
    }

    const { tags, tagIds, learningOutcomes, prerequisites, ...updateData } = dto;

    // Regenerate slug if title changed
    const data: Prisma.CourseUpdateInput = {
      ...updateData,
      ...(learningOutcomes !== undefined && {
        learningOutcomes: learningOutcomes as unknown as Prisma.InputJsonValue,
      }),
      ...(prerequisites !== undefined && {
        prerequisites: prerequisites as unknown as Prisma.InputJsonValue,
      }),
    };
    if (dto.title && dto.title !== course.title) {
      data.slug = generateUniqueSlug(dto.title);
    }

    return this.prisma.$transaction(async (tx) => {
      // Update tags — tagIds (from selector) takes priority over tag names
      if (tagIds !== undefined) {
        await tx.courseTag.deleteMany({ where: { courseId } });
        if (tagIds.length > 0) {
          await tx.courseTag.createMany({
            data: tagIds.map((tagId) => ({ courseId, tagId })),
          });
        }
      } else if (tags !== undefined) {
        await tx.courseTag.deleteMany({ where: { courseId } });
        if (tags.length > 0) {
          const tagLinks = await this.findOrCreateTags(tags);
          await tx.courseTag.createMany({
            data: tagLinks.map((t) => ({ courseId, tagId: t.tagId })),
          });
        }
      }

      return tx.course.update({
        where: { id: courseId },
        data,
        include: {
          category: true,
          courseTags: { include: { tag: true } },
        },
      });
    });
  }

  async findById(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        courseTags: { include: { tag: true } },
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
                    fileUrl: true,
                    fileMimeType: true,
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

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_COURSE_OWNER' });
    }

    return course;
  }

  async getInstructorCourses(instructorId: string, query: QueryCoursesDto) {
    const where: Prisma.CourseWhereInput = {
      instructorId,
      deletedAt: null,
    };

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          status: true,
          price: true,
          totalStudents: true,
          totalLessons: true,
          avgRating: true,
          reviewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return createPaginatedResult(courses, total, query.page, query.limit);
  }

  // ==================== STUDENTS ====================

  async getCourseStudents(courseId: string, instructorId: string, query: QueryCourseStudentsDto) {
    await this.verifyOwnership(courseId, instructorId);

    const where: Prisma.EnrollmentWhereInput = {
      courseId,
      ...(query.search && {
        user: {
          fullName: { contains: query.search, mode: 'insensitive' as const },
        },
      }),
    };

    const [enrollments, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return createPaginatedResult(enrollments, total, query.page, query.limit);
  }

  // ==================== PUBLISHING FLOW ====================

  async submitForReview(courseId: string, instructorId: string) {
    const course = await this.verifyOwnership(courseId, instructorId);

    if (course.status !== 'DRAFT' && course.status !== 'REJECTED') {
      throw new BadRequestException({ code: 'INVALID_COURSE_STATUS' });
    }

    await this.validateCourseCompleteness(courseId);

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'PENDING_REVIEW' },
    });

    this.queue.addAdminNotification('COURSE_PENDING_REVIEW', {
      courseId,
      courseTitle: course.title,
      instructorId,
    });

    return updated;
  }

  async softDelete(courseId: string, instructorId: string) {
    await this.verifyOwnership(courseId, instructorId);

    return this.prisma.course.update({
      where: { id: courseId },
      data: { deletedAt: new Date() },
    });
  }

  // ==================== TAGS ====================

  async updateTags(courseId: string, instructorId: string, tagIds: string[]) {
    await this.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction([
      this.prisma.courseTag.deleteMany({ where: { courseId } }),
      this.prisma.courseTag.createMany({
        data: tagIds.map((tagId) => ({ courseId, tagId })),
      }),
    ]);
  }

  // ==================== SHARED HELPERS ====================

  /** Verify instructor owns the course. Used by sub-services. */
  async verifyOwnership(courseId: string, instructorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.deletedAt) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    if (course.instructorId !== instructorId) {
      throw new ForbiddenException({ code: 'NOT_COURSE_OWNER' });
    }

    return course;
  }

  // ==================== PRIVATE HELPERS ====================

  private async validateCourseCompleteness(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: {
            chapters: {
              include: {
                lessons: {
                  select: { id: true, type: true, textContent: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });
    }

    if (!course.title || !course.description || !course.categoryId) {
      throw new BadRequestException({ code: 'COURSE_INCOMPLETE_INFO' });
    }

    if (course.sections.length === 0) {
      throw new BadRequestException({ code: 'COURSE_NO_SECTIONS' });
    }

    const hasContent = course.sections.some((section) =>
      section.chapters.some((chapter) => chapter.lessons.length > 0),
    );

    if (!hasContent) {
      throw new BadRequestException({ code: 'COURSE_NO_CONTENT' });
    }
  }

  private async findOrCreateTags(tagNames: string[]): Promise<{ tagId: string }[]> {
    const result: { tagId: string }[] = [];

    for (const name of tagNames) {
      const tag = await this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, slug: generateSlug(name) },
      });
      result.push({ tagId: tag.id });
    }

    return result;
  }
}

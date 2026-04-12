import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CourseManagementService } from '../management/course-management.service';
import type { CreateSectionDto, UpdateSectionDto } from '../dto/create-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
  ) {}

  async create(courseId: string, instructorId: string, dto: CreateSectionDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastSection = await this.prisma.section.findFirst({
        where: { courseId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastSection?.order ?? -1) + 1;
    }

    return this.prisma.section.create({
      data: { title: dto.title, order: dto.order, courseId },
    });
  }

  async update(courseId: string, sectionId: string, instructorId: string, dto: UpdateSectionDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifySectionBelongsToCourse(sectionId, courseId);

    return this.prisma.section.update({
      where: { id: sectionId },
      data: dto,
    });
  }

  async delete(courseId: string, sectionId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifySectionBelongsToCourse(sectionId, courseId);

    await this.prisma.section.update({ where: { id: sectionId }, data: { deletedAt: new Date() } });

    // Recalculate course counters after cascade delete
    await this.recalculateCourseCounters(courseId);
  }

  async reorder(courseId: string, instructorId: string, orderedIds: string[]) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.section.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ==================== SHARED HELPERS ====================

  /** Recalculate totalLessons + totalDuration on Course from all chapters */
  async recalculateCourseCounters(courseId: string) {
    const chapters = await this.prisma.chapter.findMany({
      where: { section: { courseId } },
      select: { lessonsCount: true, totalDuration: true },
    });

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        totalLessons: chapters.reduce((sum, c) => sum + c.lessonsCount, 0),
        totalDuration: chapters.reduce((sum, c) => sum + c.totalDuration, 0),
      },
    });
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifySectionBelongsToCourse(sectionId: string, courseId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== courseId) {
      throw new NotFoundException({ code: 'SECTION_NOT_FOUND' });
    }
    return section;
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CourseManagementService } from '../management/course-management.service';
import { SectionsService } from '../sections/sections.service';
import type { CreateChapterDto, UpdateChapterDto } from '../dto/create-chapter.dto';

@Injectable()
export class ChaptersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CourseManagementService) private readonly courseManagement: CourseManagementService,
    @Inject(SectionsService) private readonly sectionsService: SectionsService,
  ) {}

  async create(courseId: string, sectionId: string, instructorId: string, dto: CreateChapterDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    // Auto-assign order if not provided
    if (dto.order === undefined) {
      const lastChapter = await this.prisma.chapter.findFirst({
        where: { sectionId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      dto.order = (lastChapter?.order ?? -1) + 1;
    }

    return this.prisma.chapter.create({
      data: {
        title: dto.title,
        description: dto.description,
        order: dto.order,
        price: dto.price,
        isFreePreview: dto.isFreePreview,
        sectionId,
      },
    });
  }

  async update(courseId: string, chapterId: string, instructorId: string, dto: UpdateChapterDto) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    const chapter = await this.verifyChapterBelongsToCourse(chapterId, courseId);

    return this.prisma.chapter.update({
      where: { id: chapter.id },
      data: dto,
    });
  }

  async delete(courseId: string, chapterId: string, instructorId: string) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);
    await this.verifyChapterBelongsToCourse(chapterId, courseId);

    await this.prisma.chapter.update({ where: { id: chapterId }, data: { deletedAt: new Date() } });

    // Recalculate course counters after cascade delete
    await this.sectionsService.recalculateCourseCounters(courseId);
  }

  async reorder(courseId: string, sectionId: string, instructorId: string, orderedIds: string[]) {
    await this.courseManagement.verifyOwnership(courseId, instructorId);

    // Verify sectionId exists
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== courseId) {
      throw new NotFoundException({ code: 'SECTION_NOT_FOUND' });
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.chapter.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ==================== COUNTER UPDATES ====================

  /** Recalculate lessonsCount + totalDuration on Chapter, then cascade to Course */
  async recalculateChapterCounters(chapterId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { chapterId },
      select: { estimatedDuration: true },
    });

    const chapter = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        lessonsCount: lessons.length,
        totalDuration: lessons.reduce((sum, l) => sum + (l.estimatedDuration ?? 0), 0),
      },
    });

    // Cascade: recalculate parent course counters
    const section = await this.prisma.section.findUnique({
      where: { id: chapter.sectionId },
      select: { courseId: true },
    });
    if (section) {
      await this.sectionsService.recalculateCourseCounters(section.courseId);
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private async verifyChapterBelongsToCourse(chapterId: string, courseId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { section: { select: { courseId: true } } },
    });
    if (!chapter || chapter.section.courseId !== courseId) {
      throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND' });
    }
    return chapter;
  }
}

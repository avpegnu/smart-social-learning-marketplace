import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' },
      include: {
        children: { orderBy: { order: 'asc' } },
        _count: {
          select: { courses: { where: { status: 'PUBLISHED', deletedAt: null } } },
        },
      },
    });
  }

  async findAllTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { order: 'asc' } },
        _count: {
          select: { courses: { where: { status: 'PUBLISHED', deletedAt: null } } },
        },
      },
    });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND' });
    }
    return category;
  }
}

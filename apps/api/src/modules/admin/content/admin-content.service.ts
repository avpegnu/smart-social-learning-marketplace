import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import { generateSlug } from '@/common/utils/slug.util';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCategoryDto } from '../dto/create-category.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateTagDto } from '../dto/create-tag.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCommissionTierDto } from '../dto/create-commission-tier.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateSettingDto } from '../dto/update-setting.dto';

@Injectable()
export class AdminContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // --- Categories ---

  async createCategory(dto: CreateCategoryDto) {
    const slug = generateSlug(dto.name);
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException({ code: 'CATEGORY_SLUG_EXISTS' });
    }
    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.name) {
      data['slug'] = generateSlug(dto.name);
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.course.count({
      where: { categoryId: id },
    });
    if (count > 0) {
      throw new BadRequestException({ code: 'CATEGORY_HAS_COURSES' });
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // --- Tags ---

  async getTags(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const } }
      : {};

    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { courseTags: true } } },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return createPaginatedResult(tags, total, page, limit);
  }

  async createTag(dto: CreateTagDto) {
    const slug = generateSlug(dto.name);
    const existing = await this.prisma.tag.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException({ code: 'TAG_SLUG_EXISTS' });
    }
    return this.prisma.tag.create({
      data: { name: dto.name, slug },
    });
  }

  async updateTag(id: string, dto: CreateTagDto) {
    const slug = generateSlug(dto.name);
    return this.prisma.tag.update({
      where: { id },
      data: { name: dto.name, slug },
    });
  }

  async deleteTag(id: string) {
    const count = await this.prisma.courseTag.count({
      where: { tagId: id },
    });
    if (count > 0) {
      throw new BadRequestException({ code: 'TAG_HAS_COURSES' });
    }
    return this.prisma.tag.delete({ where: { id } });
  }

  // --- Commission Tiers ---

  async getCommissionTiers() {
    return this.prisma.commissionTier.findMany({
      orderBy: { minRevenue: 'asc' },
    });
  }

  async createCommissionTier(dto: CreateCommissionTierDto) {
    return this.prisma.commissionTier.create({
      data: { minRevenue: dto.minRevenue, rate: dto.rate },
    });
  }

  async deleteCommissionTier(id: string) {
    return this.prisma.commissionTier.delete({ where: { id } });
  }

  // --- Platform Settings ---

  async getSettings() {
    return this.prisma.platformSetting.findMany();
  }

  async updateSetting(dto: UpdateSettingDto) {
    return this.prisma.platformSetting.upsert({
      where: { key: dto.key },
      update: { value: dto.value as Prisma.InputJsonValue },
      create: {
        key: dto.key,
        value: dto.value as Prisma.InputJsonValue,
      },
    });
  }
}

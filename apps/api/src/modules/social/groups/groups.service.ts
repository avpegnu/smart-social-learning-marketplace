import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { Prisma } from '@prisma/client';
import { GroupRole } from '@prisma/client';
import type { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateGroupDto } from '../dto/create-group.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateGroupDto } from '../dto/update-group.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { QueryGroupsDto } from '../dto/query-groups.dto';
import { AUTHOR_SELECT } from '../posts/posts.service';

@Injectable()
export class GroupsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateGroupDto) {
    if (dto.courseId) {
      const existing = await this.prisma.group.findUnique({
        where: { courseId: dto.courseId },
      });
      if (existing) throw new ConflictException({ code: 'COURSE_GROUP_EXISTS' });
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId,
          courseId: dto.courseId,
          privacy: dto.courseId ? 'PRIVATE' : (dto.privacy ?? 'PUBLIC'),
        },
      });

      await tx.groupMember.create({
        data: { groupId: group.id, userId: ownerId, role: 'OWNER' },
      });

      return group;
    });
  }

  async findAll(query: QueryGroupsDto) {
    const where: Prisma.GroupWhereInput = {
      privacy: 'PUBLIC',
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [groups, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        include: { owner: { select: AUTHOR_SELECT } },
        orderBy: { memberCount: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.group.count({ where }),
    ]);

    return createPaginatedResult(groups, total, query.page, query.limit);
  }

  async findById(groupId: string, currentUserId?: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: AUTHOR_SELECT },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

    let isMember = false;
    let currentUserRole: string | null = null;
    if (currentUserId) {
      const member = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: currentUserId } },
      });
      isMember = !!member;
      currentUserRole = member?.role ?? null;
    }

    return { ...group, isMember, currentUserRole };
  }

  async update(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);
    return this.prisma.group.update({
      where: { id: groupId },
      data: dto,
    });
  }

  async delete(groupId: string, userId: string) {
    await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER]);
    return this.prisma.group.delete({ where: { id: groupId } });
  }

  async join(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

    if (group.privacy === 'PRIVATE' && group.courseId) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, courseId: group.courseId },
      });
      if (!enrollment) {
        throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
      }
    }

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing) throw new ConflictException({ code: 'ALREADY_MEMBER' });

    await this.prisma.$transaction([
      this.prisma.groupMember.create({
        data: { groupId, userId, role: 'MEMBER' },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    return { joined: true };
  }

  async leave(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new NotFoundException({ code: 'NOT_GROUP_MEMBER' });

    if (member.role === 'OWNER') {
      throw new ForbiddenException({ code: 'OWNER_CANNOT_LEAVE' });
    }

    await this.prisma.$transaction([
      this.prisma.groupMember.delete({ where: { id: member.id } }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    return { left: true };
  }

  async getMembers(groupId: string, query: PaginationDto) {
    const [members, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.groupMember.count({ where: { groupId } }),
    ]);
    return createPaginatedResult(members, total, query.page, query.limit);
  }

  async updateMemberRole(groupId: string, userId: string, targetUserId: string, role: GroupRole) {
    await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'OWNER') {
      throw new ForbiddenException({ code: 'CANNOT_CHANGE_OWNER_ROLE' });
    }

    return this.prisma.groupMember.update({
      where: { id: target.id },
      data: { role },
    });
  }

  async kickMember(groupId: string, userId: string, targetUserId: string) {
    await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'OWNER') {
      throw new ForbiddenException({ code: 'CANNOT_KICK_OWNER' });
    }

    await this.prisma.$transaction([
      this.prisma.groupMember.delete({ where: { id: target.id } }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);
  }

  async getGroupPosts(groupId: string, userId: string, query: PaginationDto) {
    await this.verifyGroupMember(groupId, userId);

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { groupId, deletedAt: null },
        include: {
          author: { select: AUTHOR_SELECT },
          images: { orderBy: { order: 'asc' }, take: 4 },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.post.count({ where: { groupId, deletedAt: null } }),
    ]);

    return createPaginatedResult(posts, total, query.page, query.limit);
  }

  private async verifyGroupRole(groupId: string, userId: string, allowedRoles: GroupRole[]) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member || !allowedRoles.includes(member.role)) {
      throw new ForbiddenException({ code: 'INSUFFICIENT_GROUP_ROLE' });
    }
    return member;
  }

  private async verifyGroupMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) throw new ForbiddenException({ code: 'NOT_GROUP_MEMBER' });
    return member;
  }
}

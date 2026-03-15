import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { createPaginatedResult } from '@/common/utils/pagination.util';
import type { PaginationDto } from '@/common/dto/pagination.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateConversationDto } from './dto/create-conversation.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SendMessageDto } from './dto/send-message.dto';

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async getConversations(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: AUTHOR_SELECT } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: AUTHOR_SELECT } },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const otherMembers = m.conversation.members.filter((mem) => mem.userId !== userId);

        const isOnline =
          otherMembers.length === 1
            ? !!(await this.redis.get(`online:${otherMembers[0]!.userId}`))
            : false;

        const unreadCount = m.lastReadAt
          ? await this.prisma.message.count({
              where: {
                conversationId: m.conversationId,
                createdAt: { gt: m.lastReadAt },
                senderId: { not: userId },
              },
            })
          : await this.prisma.message.count({
              where: {
                conversationId: m.conversationId,
                senderId: { not: userId },
              },
            });

        return {
          ...m.conversation,
          isOnline,
          unreadCount,
          lastMessage: m.conversation.messages[0] ?? null,
        };
      }),
    );
  }

  async getOrCreateConversation(userId: string, dto: CreateConversationDto) {
    if (!dto.isGroup) {
      // Find existing 1-on-1
      const existing = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: dto.participantId } } },
          ],
        },
        include: {
          members: { include: { user: { select: AUTHOR_SELECT } } },
        },
      });
      if (existing) return existing;

      return this.prisma.conversation.create({
        data: {
          members: {
            create: [{ userId }, { userId: dto.participantId }],
          },
        },
        include: {
          members: { include: { user: { select: AUTHOR_SELECT } } },
        },
      });
    }

    // Group conversation
    const participantIds = [userId, ...(dto.participantIds ?? [])];
    return this.prisma.conversation.create({
      data: {
        isGroup: true,
        name: dto.name,
        members: {
          create: participantIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        members: { include: { user: { select: AUTHOR_SELECT } } },
      },
    });
  }

  async sendMessage(senderId: string, conversationId: string, dto: SendMessageDto) {
    await this.verifyMembership(conversationId, senderId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: dto.type ?? 'TEXT',
        content: dto.content,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
      },
      include: { sender: { select: AUTHOR_SELECT } },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(conversationId: string, userId: string, query: PaginationDto) {
    await this.verifyMembership(conversationId, userId);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: { sender: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return createPaginatedResult(messages, total, query.page, query.limit);
  }

  async markRead(conversationId: string, userId: string) {
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { lastReadAt: new Date() },
    });
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    return !!member;
  }

  private async verifyMembership(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException({ code: 'NOT_CONVERSATION_MEMBER' });
    }
    return member;
  }
}

# Phase 5.9 — SOCIAL & CHAT MODULE

> Posts, Comments, Likes, Bookmarks, Feed (fanout-on-write), Groups, Chat (WebSocket).
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: Posts Service](#step-2-posts-service)
- [Step 3: Comments Service](#step-3-comments-service)
- [Step 4: Like & Bookmark Service](#step-4-like--bookmark-service)
- [Step 5: Feed Service (Fanout-on-Write)](#step-5-feed-service-fanout-on-write)
- [Step 6: Groups Service](#step-6-groups-service)
- [Step 7: Chat Service](#step-7-chat-service)
- [Step 8: Chat WebSocket Gateway](#step-8-chat-websocket-gateway)
- [Step 9: Controllers](#step-9-controllers)
- [Step 10: Verify](#step-10-verify)

---

## Step 1: Module Structure

```
src/modules/social/
├── social.module.ts
├── posts/
│   ├── posts.controller.ts
│   └── posts.service.ts
├── follows/
│   └── follows.service.ts        # (đã implement trong users module)
├── feed/
│   ├── feed.controller.ts
│   └── feed.service.ts
├── chat/
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── chat.gateway.ts           # WebSocket
├── groups/
│   ├── groups.controller.ts
│   └── groups.service.ts
└── dto/
    ├── create-post.dto.ts
    ├── create-comment.dto.ts
    ├── send-message.dto.ts
    └── create-group.dto.ts
```

---

## Step 2: Posts Service

```typescript
@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        type: dto.type || 'TEXT',
        content: dto.content,
        codeSnippet: dto.codeSnippet,
        linkUrl: dto.linkUrl,
        groupId: dto.groupId,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, i) => ({ url, order: i })) }
          : undefined,
      },
      include: { images: true, author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    // Fanout to followers' feeds (async via queue in production)
    await this.fanoutToFollowers(authorId, post.id);

    return post;
  }

  async findById(postId: string) {
    return this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        images: { orderBy: { order: 'asc' } },
        sharedPost: {
          include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    });
  }

  async delete(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_POST_OWNER' });
    }
    return this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  }

  async share(userId: string, postId: string, content?: string) {
    const post = await this.prisma.$transaction(async (tx) => {
      const shared = await tx.post.create({
        data: {
          authorId: userId,
          type: 'SHARED',
          content,
          sharedPostId: postId,
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
      });

      return shared;
    });

    await this.fanoutToFollowers(userId, post.id);
    return post;
  }

  private async fanoutToFollowers(authorId: string, postId: string) {
    const followers = await this.prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });

    if (followers.length > 0) {
      await this.prisma.feedItem.createMany({
        data: followers.map((f) => ({
          userId: f.followerId,
          postId,
        })),
      });
    }

    // Also add to author's own feed
    await this.prisma.feedItem.create({
      data: { userId: authorId, postId },
    });
  }
}
```

---

## Step 3: Comments Service

```typescript
@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, postId: string, dto: CreateCommentDto) {
    const comment = await this.prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          content: dto.content,
          authorId,
          postId,
          parentId: dto.parentId, // null for top-level, id for reply
        },
        include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return newComment;
    });

    return comment;
  }

  async getByPost(postId: string, query: PaginationDto) {
    // Get top-level comments with first 3 replies
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: null },
        include: {
          author: { select: { id: true, fullName: true, avatarUrl: true } },
          replies: {
            take: 3,
            include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.comment.count({ where: { postId, parentId: null } }),
    ]);

    return createPaginatedResult(comments, total, query.page, query.limit);
  }
}
```

---

## Step 4: Like & Bookmark Service

```typescript
// Toggle pattern — same for Like and Bookmark
async toggleLike(userId: string, postId: string) {
  const existing = await this.prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    await this.prisma.$transaction([
      this.prisma.like.delete({ where: { id: existing.id } }),
      this.prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
    ]);
    return { liked: false };
  }

  await this.prisma.$transaction([
    this.prisma.like.create({ data: { userId, postId } }),
    this.prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
  ]);
  return { liked: true };
}
```

---

## Step 5: Feed Service (Fanout-on-Write)

```typescript
@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeed(userId: string, query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              author: { select: { id: true, fullName: true, avatarUrl: true } },
              images: { orderBy: { order: 'asc' }, take: 4 },
              sharedPost: {
                include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.feedItem.count({ where: { userId } }),
    ]);

    // Filter out deleted posts
    const filtered = items.filter((item) => !item.post.deletedAt);

    return createPaginatedResult(
      filtered.map((item) => item.post),
      total,
      query.page,
      query.limit,
    );
  }
}
```

---

## Step 6: Groups Service

```typescript
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId,
          courseId: dto.courseId,
        },
      });

      // Auto-add owner as OWNER member
      await tx.groupMember.create({
        data: { groupId: group.id, userId: ownerId, role: 'OWNER' },
      });

      return group;
    });
  }

  async join(groupId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.groupMember.create({
        data: { groupId, userId, role: 'MEMBER' },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);
    return { message: 'JOINED' };
  }

  async leave(groupId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.groupMember.deleteMany({
        where: { groupId, userId },
      }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);
    return { message: 'LEFT' };
  }
}
```

---

## Step 7: Chat Service

```typescript
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getConversations(userId: string) {
    return this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });
  }

  async getOrCreateConversation(userId: string, otherUserId: string) {
    // Find existing 1-on-1 conversation
    const existing = await this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: { every: { userId: { in: [userId, otherUserId] } } },
        AND: [{ members: { some: { userId } } }, { members: { some: { userId: otherUserId } } }],
      },
    });
    if (existing) return existing;

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: { members: true },
    });
  }

  async sendMessage(senderId: string, conversationId: string, dto: SendMessageDto) {
    // Verify membership
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: senderId } },
    });
    if (!member) throw new ForbiddenException({ code: 'NOT_CONVERSATION_MEMBER' });

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: dto.type || 'TEXT',
        content: dto.content,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
      },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    // Update conversation updatedAt for sorting
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(conversationId: string, userId: string, query: PaginationDto) {
    // Verify membership
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException({ code: 'NOT_CONVERSATION_MEMBER' });

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
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
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }
}
```

---

## Step 8: Chat WebSocket Gateway

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  type MessageBody,
  type ConnectedSocket,
} from '@nestjs/websockets';
import { Server, type Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { RedisService } from '@/redis/redis.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: ['http://localhost:3001', 'http://localhost:3002'] },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    try {
      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub}`);
      await this.redis.setex(`online:${payload.sub}`, 300, '1');
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      await this.redis.del(`online:${client.data.userId}`);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conv_${data.conversationId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; type?: string },
  ) {
    const message = await this.chatService.sendMessage(client.data.userId, data.conversationId, {
      content: data.content,
      type: data.type as any,
    });

    // Emit to all members in the conversation room
    this.server.to(`conv_${data.conversationId}`).emit('new_message', message);
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.to(`conv_${data.conversationId}`).emit('typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.to(`conv_${data.conversationId}`).emit('stop_typing', {
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.chatService.markRead(data.conversationId, client.data.userId);
  }
}
```

---

## Step 9: Controllers

| Method | Path                            | Auth   | Description         |
| ------ | ------------------------------- | ------ | ------------------- |
| POST   | /api/posts                      | User   | Create post         |
| GET    | /api/posts/:id                  | Public | Get post detail     |
| DELETE | /api/posts/:id                  | Owner  | Soft delete post    |
| POST   | /api/posts/:id/share            | User   | Share post          |
| POST   | /api/posts/:id/like             | User   | Toggle like         |
| POST   | /api/posts/:id/bookmark         | User   | Toggle bookmark     |
| GET    | /api/posts/:id/comments         | Public | Get comments        |
| POST   | /api/posts/:id/comments         | User   | Add comment         |
| GET    | /api/feed                       | User   | Get personal feed   |
| POST   | /api/groups                     | User   | Create group        |
| POST   | /api/groups/:id/join            | User   | Join group          |
| DELETE | /api/groups/:id/leave           | User   | Leave group         |
| GET    | /api/groups/:id/posts           | User   | Get group posts     |
| GET    | /api/conversations              | User   | List conversations  |
| POST   | /api/conversations/:userId      | User   | Get/create DM       |
| GET    | /api/conversations/:id/messages | User   | Get messages        |
| POST   | /api/conversations/:id/messages | User   | Send message (REST) |

WebSocket events: `join_conversation`, `send_message`, `typing`, `stop_typing`, `mark_read`

---

## Step 10: Verify

### Checklist

- [ ] Post CRUD with images
- [ ] Comments (nested replies)
- [ ] Like/bookmark toggle with counter updates
- [ ] Feed shows posts from followed users
- [ ] Fanout-on-write creates FeedItem for each follower
- [ ] Group create/join/leave with member count
- [ ] Chat conversations (1-on-1 and group)
- [ ] Messages with pagination
- [ ] WebSocket: connect with JWT, join room, send/receive messages
- [ ] Typing indicators work via WebSocket
- [ ] Online status tracked in Redis
- [ ] Mark read updates lastReadAt

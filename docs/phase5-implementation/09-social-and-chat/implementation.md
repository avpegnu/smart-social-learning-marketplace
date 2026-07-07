# Phase 5.9 — SOCIAL & CHAT MODULE

> Posts, Comments, Likes, Bookmarks, Feed (fanout-on-write), Groups, Chat (REST + WebSocket).
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`
> Prisma models: Post, PostImage, Like, Comment, Bookmark, FeedItem, Group, GroupMember, Conversation, ConversationMember, Message

---

## Mục lục

- [Step 1: Module Structure](#step-1-module-structure)
- [Step 2: DTOs](#step-2-dtos)
- [Step 3: Posts Service](#step-3-posts-service)
- [Step 4: Comments Service](#step-4-comments-service)
- [Step 5: Like & Bookmark Service](#step-5-like--bookmark-service)
- [Step 6: Feed Service](#step-6-feed-service)
- [Step 7: Groups Service](#step-7-groups-service)
- [Step 8: Chat Service](#step-8-chat-service)
- [Step 9: Chat WebSocket Gateway](#step-9-chat-websocket-gateway)
- [Step 10: Controllers](#step-10-controllers)
- [Step 11: Module & Registration](#step-11-module--registration)
- [Step 12: Verify](#step-12-verify)

---

## Step 1: Module Structure

```
src/modules/social/
├── social.module.ts
├── posts/
│   ├── posts.controller.ts
│   ├── posts.service.ts
│   └── posts.service.spec.ts
├── comments/
│   ├── comments.service.ts
│   └── comments.service.spec.ts
├── interactions/
│   ├── interactions.controller.ts      # Like + Bookmark endpoints
│   ├── interactions.service.ts
│   └── interactions.service.spec.ts
├── feed/
│   ├── feed.controller.ts
│   ├── feed.service.ts
│   └── feed.service.spec.ts
├── groups/
│   ├── groups.controller.ts
│   ├── groups.service.ts
│   └── groups.service.spec.ts
└── dto/
    ├── create-post.dto.ts
    ├── update-post.dto.ts
    ├── create-comment.dto.ts
    ├── create-group.dto.ts
    ├── update-group.dto.ts
    ├── query-groups.dto.ts
    └── dto.validation.spec.ts

src/modules/chat/
├── chat.module.ts
├── chat.controller.ts
├── chat.service.ts
├── chat.service.spec.ts
├── chat.gateway.ts
├── chat.gateway.spec.ts
└── dto/
    ├── create-conversation.dto.ts
    ├── send-message.dto.ts
    └── dto.validation.spec.ts
```

### Tại sao tách Social + Chat thành 2 modules?

- **Social**: đồng bộ (REST only), phụ thuộc PrismaService
- **Chat**: bất đồng bộ (REST + WebSocket), phụ thuộc PrismaService + JwtService + RedisService
- Tách để tránh circular dependencies và giữ module nhỏ gọn

---

## Step 2: DTOs

### 2.1 create-post.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, IsArray, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '@prisma/client';

export class CodeSnippetDto {
  @IsString()
  language!: string;

  @IsString()
  @MaxLength(5000)
  code!: string;
}

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  groupId?: string;
}
```

### 2.2 update-post.dto.ts

```typescript
import { IsString, IsOptional, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CodeSnippetDto } from './create-post.dto';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CodeSnippetDto)
  codeSnippet?: CodeSnippetDto;

  @IsOptional()
  @IsString()
  linkUrl?: string;
}
```

### 2.3 create-comment.dto.ts

```typescript
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
```

### 2.4 create-group.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { GroupPrivacy } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(GroupPrivacy)
  privacy?: GroupPrivacy;

  @IsOptional()
  @IsString()
  courseId?: string;
}
```

### 2.5 update-group.dto.ts

```typescript
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

### 2.6 query-groups.dto.ts

```typescript
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class QueryGroupsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
```

### 2.7 create-conversation.dto.ts

```typescript
import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  participantId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsBoolean()
  isGroup?: boolean;

  @IsOptional()
  @IsString()
  name?: string;
}
```

### 2.8 send-message.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
```

---

## Step 3: Posts Service

```typescript
// Author select constant — reused across all social queries
const AUTHOR_SELECT = {
  id: true, fullName: true, avatarUrl: true,
} as const;

@Injectable()
export class PostsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        type: dto.type ?? 'TEXT',
        content: dto.content,
        codeSnippet: dto.codeSnippet as unknown as Prisma.InputJsonValue,
        linkUrl: dto.linkUrl,
        groupId: dto.groupId,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, i) => ({ url, order: i })) }
          : undefined,
      },
      include: { images: true, author: { select: AUTHOR_SELECT } },
    });

    // Fanout to followers' feeds (sync for now, queue in production)
    await this.fanoutToFollowers(authorId, post.id, dto.groupId);
    return post;
  }

  async findById(postId: string, currentUserId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      include: {
        author: { select: AUTHOR_SELECT },
        images: { orderBy: { order: 'asc' } },
        sharedPost: {
          include: { author: { select: AUTHOR_SELECT } },
        },
      },
    });

    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    // Enrich with isLiked / isBookmarked for current user
    let isLiked = false;
    let isBookmarked = false;

    if (currentUserId) {
      const [like, bookmark] = await Promise.all([
        this.prisma.like.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
        this.prisma.bookmark.findUnique({
          where: { userId_postId: { userId: currentUserId, postId } },
        }),
      ]);
      isLiked = !!like;
      isBookmarked = !!bookmark;
    }

    return { ...post, isLiked, isBookmarked };
  }

  async update(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_POST_OWNER' });
    }
    if (post.deletedAt) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
        codeSnippet: dto.codeSnippet
          ? (dto.codeSnippet as unknown as Prisma.InputJsonValue)
          : undefined,
        linkUrl: dto.linkUrl,
      },
      include: { images: true, author: { select: AUTHOR_SELECT } },
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
    // Verify original post exists and not deleted
    const original = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!original) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const post = await this.prisma.$transaction(async (tx) => {
      const shared = await tx.post.create({
        data: {
          authorId: userId,
          type: 'SHARED',
          content,
          sharedPostId: postId,
        },
        include: { author: { select: AUTHOR_SELECT } },
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

  // --- Fanout ---

  private async fanoutToFollowers(authorId: string, postId: string, groupId?: string) {
    if (groupId) {
      // Group post → fanout to group members only
      const members = await this.prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });
      if (members.length > 0) {
        await this.prisma.feedItem.createMany({
          data: members.map((m) => ({ userId: m.userId, postId })),
          skipDuplicates: true,
        });
      }
      return;
    }

    // Public post → fanout to followers
    const followers = await this.prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });

    const feedData = followers.map((f) => ({ userId: f.followerId, postId }));
    // Also add to author's own feed
    feedData.push({ userId: authorId, postId });

    if (feedData.length > 0) {
      await this.prisma.feedItem.createMany({
        data: feedData,
        skipDuplicates: true,
      });
    }
  }
}
```

**Key points:**
- `AUTHOR_SELECT` constant for consistent user info across queries
- `findById` enriches with `isLiked`/`isBookmarked` via parallel queries
- `codeSnippet` cast to `Prisma.InputJsonValue` (Json field)
- Fanout logic: group posts → group members, public posts → followers + author
- `skipDuplicates: true` on createMany prevents crash on race conditions
- Soft delete via `deletedAt` timestamp

---

## Step 4: Comments Service

```typescript
@Injectable()
export class CommentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(authorId: string, postId: string, dto: CreateCommentDto) {
    // Verify post exists and not deleted
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    // If reply, verify parent comment exists and belongs to same post
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException({ code: 'INVALID_PARENT_COMMENT' });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          content: dto.content,
          authorId,
          postId,
          parentId: dto.parentId,
        },
        include: { author: { select: AUTHOR_SELECT } },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return comment;
    });
  }

  async getByPost(postId: string, query: PaginationDto) {
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: null },
        include: {
          author: { select: AUTHOR_SELECT },
          replies: {
            take: 3,
            include: { author: { select: AUTHOR_SELECT } },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.comment.count({ where: { postId, parentId: null } }),
    ]);

    return createPaginatedResult(comments, total, query.page, query.limit);
  }

  async getReplies(commentId: string, query: PaginationDto) {
    const [replies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { parentId: commentId },
        include: { author: { select: AUTHOR_SELECT } },
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.comment.count({ where: { parentId: commentId } }),
    ]);
    return createPaginatedResult(replies, total, query.page, query.limit);
  }

  async delete(commentId: string, userId: string, postId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== userId) {
      throw new ForbiddenException({ code: 'NOT_COMMENT_OWNER' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      // Count cascaded replies + 1 for the deleted comment
      const deletedCount = 1; // Prisma cascade handles replies automatically
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: deletedCount } },
      });
    });
  }
}
```

**Key points:**
- Top-level comments only (`parentId: null`) with first 3 replies inlined
- `_count: { select: { replies: true } }` for "View more replies" button
- `getReplies` for loading remaining replies on demand
- Parent comment validation: must exist + belong to same post
- Comment delete decrements post.commentCount in transaction

---

## Step 5: Like & Bookmark Service

```typescript
@Injectable()
export class InteractionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async toggleLike(userId: string, postId: string) {
    // Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const existing = await this.prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.like.delete({ where: { id: existing.id } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false, likeCount: post.likeCount - 1 };
    }

    await this.prisma.$transaction([
      this.prisma.like.create({ data: { userId, postId } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    return { liked: true, likeCount: post.likeCount + 1 };
  }

  async toggleBookmark(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException({ code: 'POST_NOT_FOUND' });

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, postId } });
    return { bookmarked: true };
  }

  async getBookmarks(userId: string, query: PaginationDto) {
    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              author: { select: AUTHOR_SELECT },
              images: { orderBy: { order: 'asc' }, take: 4 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.bookmark.count({ where: { userId } }),
    ]);

    return createPaginatedResult(
      bookmarks.map((b) => b.post),
      total,
      query.page,
      query.limit,
    );
  }
}
```

**Key points:**
- Toggle pattern: check existing → delete if found, create if not
- Like returns `{ liked, likeCount }` matching API doc response
- Bookmark returns `{ bookmarked }` — no count needed
- `getBookmarks` returns posts (unwrapped from bookmark relation)

---

## Step 6: Feed Service

```typescript
@Injectable()
export class FeedService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getFeed(userId: string, query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.feedItem.findMany({
        where: { userId, post: { deletedAt: null } },
        include: {
          post: {
            include: {
              author: { select: AUTHOR_SELECT },
              images: { orderBy: { order: 'asc' }, take: 4 },
              sharedPost: {
                include: { author: { select: AUTHOR_SELECT } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.feedItem.count({
        where: { userId, post: { deletedAt: null } },
      }),
    ]);

    // Enrich with isLiked / isBookmarked for current user (batch)
    const postIds = items.map((item) => item.post.id);

    const [likes, bookmarks] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId, postId: { in: postIds } },
        select: { postId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l) => l.postId));
    const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));

    const posts = items.map((item) => ({
      ...item.post,
      isLiked: likedSet.has(item.post.id),
      isBookmarked: bookmarkedSet.has(item.post.id),
    }));

    return createPaginatedResult(posts, total, query.page, query.limit);
  }
}
```

**Key points:**
- Filter deleted posts at query level (`post: { deletedAt: null }`)
- Batch lookup `isLiked`/`isBookmarked` using `findMany` + `Set` — same O(1) pattern as `enrichWithFollowStatus` in Phase 5.5
- Images limited to 4 per post (preview grid)
- Feed reads from pre-computed `feedItem` table (fanout-on-write)

---

## Step 7: Groups Service

```typescript
@Injectable()
export class GroupsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateGroupDto) {
    // If course group, verify course exists and no group yet
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

      // Auto-add owner as OWNER member
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
    let role: string | null = null;
    if (currentUserId) {
      const member = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: currentUserId } },
      });
      isMember = !!member;
      role = member?.role ?? null;
    }

    return { ...group, isMember, currentUserRole: role };
  }

  async update(groupId: string, userId: string, dto: UpdateGroupDto) {
    await this.verifyGroupRole(groupId, userId, ['OWNER', 'ADMIN']);
    return this.prisma.group.update({
      where: { id: groupId },
      data: dto,
    });
  }

  async delete(groupId: string, userId: string) {
    await this.verifyGroupRole(groupId, userId, ['OWNER']);
    return this.prisma.group.delete({ where: { id: groupId } });
  }

  async join(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

    // Private course group → check enrollment
    if (group.privacy === 'PRIVATE' && group.courseId) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, courseId: group.courseId },
      });
      if (!enrollment) {
        throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
      }
    }

    // Check not already member
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

    // Owner cannot leave — must delete group or transfer ownership
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
    await this.verifyGroupRole(groupId, userId, ['OWNER', 'ADMIN']);

    // Cannot change owner's role
    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'OWNER') throw new ForbiddenException({ code: 'CANNOT_CHANGE_OWNER_ROLE' });

    return this.prisma.groupMember.update({
      where: { id: target.id },
      data: { role },
    });
  }

  async kickMember(groupId: string, userId: string, targetUserId: string) {
    await this.verifyGroupRole(groupId, userId, ['OWNER', 'ADMIN']);

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND' });
    if (target.role === 'OWNER') throw new ForbiddenException({ code: 'CANNOT_KICK_OWNER' });

    await this.prisma.$transaction([
      this.prisma.groupMember.delete({ where: { id: target.id } }),
      this.prisma.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);
  }

  async getGroupPosts(groupId: string, userId: string, query: PaginationDto) {
    // Verify membership
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

  // --- Helpers ---

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
```

**Key points:**
- Course groups auto-set `PRIVATE` privacy
- Private course groups require enrollment to join
- Owner cannot leave (prevents orphaned groups)
- `verifyGroupRole` helper for OWNER/ADMIN checks
- Group search only shows PUBLIC groups
- `findById` enriches with `isMember` + `currentUserRole`
- Member management: updateRole, kick (OWNER/ADMIN only, cannot change owner)

---

## Step 8: Chat Service

```typescript
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

    // Enrich with online status + unread count
    return Promise.all(
      memberships.map(async (m) => {
        const otherMembers = m.conversation.members.filter((mem) => mem.userId !== userId);
        const isOnline = otherMembers.length === 1
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
              where: { conversationId: m.conversationId, senderId: { not: userId } },
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
      // 1-on-1: find existing or create
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
    // Verify membership
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

    // Update conversation updatedAt for sorting
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
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!member;
  }

  // --- Helper ---

  private async verifyMembership(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException({ code: 'NOT_CONVERSATION_MEMBER' });
    return member;
  }
}
```

**Key points:**
- `getOrCreateConversation`: find existing 1-on-1 by AND clause (both users are members), create if not found
- Online status from Redis (`online:{userId}` key, set by gateway with 5min TTL)
- Unread count calculated from messages after `lastReadAt`
- `isMember` public method for gateway to verify before joining rooms
- REST `sendMessage` is fallback — primary path is WebSocket

---

## Step 9: Chat WebSocket Gateway

```typescript
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [
      process.env.STUDENT_PORTAL_URL || 'http://localhost:3001',
      process.env.MANAGEMENT_PORTAL_URL || 'http://localhost:3002',
    ],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
      });
      client.data.userId = payload.sub;
      client.join(`user_${payload.sub as string}`);
      await this.redis.setex(`online:${payload.sub as string}`, 300, '1');
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      await this.redis.del(`online:${client.data.userId as string}`);
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const canJoin = await this.chatService.isMember(data.conversationId, userId);
    if (!canJoin) return { error: 'NOT_CONVERSATION_MEMBER' };

    client.join(`conv_${data.conversationId}`);
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; type?: MessageType },
  ) {
    const userId = client.data.userId as string;

    const message = await this.chatService.sendMessage(userId, data.conversationId, {
      content: data.content,
      type: data.type,
    } as SendMessageDto);

    // Broadcast to all members in the conversation room
    this.server.to(`conv_${data.conversationId}`).emit('new_message', message);

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.to(`conv_${data.conversationId}`).emit('user_typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.to(`conv_${data.conversationId}`).emit('user_stop_typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    await this.chatService.markRead(data.conversationId, userId);

    // Broadcast read receipt
    client.to(`conv_${data.conversationId}`).emit('message_read', {
      userId,
      conversationId: data.conversationId,
    });
  }
}
```

**Key points:**
- JWT verification in `handleConnection` — disconnect if invalid
- `MessageType` imported from `@prisma/client` — no `any` type
- `isMember` check before joining conversation room
- `sendMessage` delegates to ChatService (single source of truth for DB operations)
- Online status: `setex` with 300s TTL (5 minutes)
- Read receipts broadcast to other members via `client.to()` (excludes sender)

---

## Step 10: Controllers

### 10.1 PostsController

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/posts | Authenticated | Create post |
| GET | /api/posts/:id | Public (optional auth) | Get post detail with isLiked/isBookmarked |
| PUT | /api/posts/:id | Owner | Update post |
| DELETE | /api/posts/:id | Owner | Soft delete post |
| POST | /api/posts/:id/share | Authenticated | Share post |
| POST | /api/posts/:id/like | Authenticated | Toggle like |
| POST | /api/posts/:id/bookmark | Authenticated | Toggle bookmark |
| GET | /api/posts/:id/comments | Public | Get comments (paginated, nested replies) |
| POST | /api/posts/:id/comments | Authenticated | Add comment |
| DELETE | /api/posts/:postId/comments/:commentId | Owner | Delete comment |

### 10.2 FeedController

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/feed | Authenticated | Get personal feed |
| GET | /api/bookmarks | Authenticated | Get bookmarked posts |

### 10.3 GroupsController

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/groups | Public | List public groups |
| POST | /api/groups | Authenticated | Create group |
| GET | /api/groups/:id | Public (optional auth) | Group detail |
| PUT | /api/groups/:id | Owner/Admin | Update group |
| DELETE | /api/groups/:id | Owner | Delete group |
| POST | /api/groups/:id/join | Authenticated | Join group |
| POST | /api/groups/:id/leave | Authenticated | Leave group |
| GET | /api/groups/:id/members | Member | List members |
| PUT | /api/groups/:id/members/:userId | Owner/Admin | Change member role |
| DELETE | /api/groups/:id/members/:userId | Owner/Admin | Kick member |
| GET | /api/groups/:id/posts | Member | Get group posts |
| POST | /api/groups/:id/posts | Member | Create post in group |

### 10.4 ChatController

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/conversations | Authenticated | List conversations |
| POST | /api/conversations | Authenticated | Get/create conversation |
| GET | /api/conversations/:id/messages | Member | Get messages |
| POST | /api/conversations/:id/messages | Member | Send message (REST fallback) |

**WebSocket events (namespace: /chat):**
| Event | Direction | Data |
|-------|-----------|------|
| `join_conversation` | Client → Server | `{ conversationId }` |
| `send_message` | Client → Server | `{ conversationId, content, type? }` |
| `typing` | Client → Server | `{ conversationId }` |
| `stop_typing` | Client → Server | `{ conversationId }` |
| `mark_read` | Client → Server | `{ conversationId }` |
| `new_message` | Server → Client | `Message` object |
| `user_typing` | Server → Client | `{ userId, conversationId }` |
| `user_stop_typing` | Server → Client | `{ userId, conversationId }` |
| `message_read` | Server → Client | `{ userId, conversationId }` |

---

## Step 11: Module & Registration

### SocialModule

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [PostsController, FeedController, GroupsController],
  providers: [PostsService, CommentsService, InteractionsService, FeedService, GroupsService],
  exports: [PostsService, GroupsService],
})
export class SocialModule {}
```

### ChatModule

```typescript
@Module({
  imports: [PrismaModule, JwtModule.register({}), RedisModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
```

### AppModule

```typescript
imports: [
  // ...existing
  SocialModule,
  ChatModule,
],
```

---

## Step 12: Verify

### Checklist

- [ ] Post CRUD (create, read, update, soft delete)
- [ ] Post create with images (PostImage relation)
- [ ] Post share with shareCount increment
- [ ] Comments (nested replies, first 3 inlined, load more)
- [ ] Delete comment with commentCount decrement
- [ ] Like toggle with likeCount + return count
- [ ] Bookmark toggle + GET /api/bookmarks
- [ ] Feed shows posts from followed users (fanout-on-write)
- [ ] Feed enriched with isLiked/isBookmarked (batch Set lookup)
- [ ] Group post fanout to group members only
- [ ] Group CRUD (create, read, update, delete)
- [ ] Group privacy: course groups auto-PRIVATE, require enrollment to join
- [ ] Group join/leave with memberCount updates
- [ ] Group member management (change role, kick)
- [ ] Owner cannot leave group
- [ ] Chat conversations (1-on-1 dedup, group create)
- [ ] Messages with pagination
- [ ] Unread count calculated from lastReadAt
- [ ] Online status in Redis (5min TTL)
- [ ] WebSocket: JWT auth on connect, disconnect cleanup
- [ ] WebSocket: join room with membership verify
- [ ] WebSocket: send message, broadcast to room
- [ ] WebSocket: typing/stop_typing indicators
- [ ] WebSocket: mark_read with broadcast read receipt
- [ ] `@Inject()` pattern on all constructors
- [ ] No `any` type anywhere
- [ ] All DTOs have `!:` on required fields
- [ ] Build 0 errors, Lint 0 errors, Tests pass

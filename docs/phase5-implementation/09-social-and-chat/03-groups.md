# 03 — Groups: Privacy, Course Integration, và Role-based Access

> Giải thích GroupsService — tạo/quản lý groups, privacy model (PUBLIC/PRIVATE),
> course group enrollment check, role hierarchy, và member management.

---

## 1. TỔNG QUAN

### 1.1 GroupsService — 11 public methods

```
GroupsService:
  CRUD:
  ├── create(ownerId, dto)                    → Tạo group + auto-add owner
  ├── findAll(query)                          → List public groups (search)
  ├── findById(groupId, currentUserId?)       → Detail + isMember + role
  ├── update(groupId, userId, dto)            → Owner/Admin only
  └── delete(groupId, userId)                 → Owner only

  Membership:
  ├── join(groupId, userId)                   → Join (enrollment check for private)
  ├── leave(groupId, userId)                  → Leave (owner cannot leave)
  ├── getMembers(groupId, query)              → Paginated member list
  ├── updateMemberRole(groupId, userId, targetId, role)
  └── kickMember(groupId, userId, targetId)

  Content:
  └── getGroupPosts(groupId, userId, query)   → Member-only posts

Private Helpers:
  ├── verifyGroupRole(groupId, userId, allowedRoles[])
  └── verifyGroupMember(groupId, userId)
```

---

## 2. GROUP PRIVACY MODEL

### 2.1 Schema change (Phase 5.9 migration)

```prisma
enum GroupPrivacy {
  PUBLIC
  PRIVATE
}

model Group {
  privacy GroupPrivacy @default(PUBLIC)
}
```

### 2.2 Hai loại groups

```
Community Groups (user tạo):
  ├── privacy: PUBLIC (default) hoặc PRIVATE (user chọn)
  ├── courseId: null
  └── Ai cũng có thể join PUBLIC groups

Course Groups (instructor tạo):
  ├── privacy: PRIVATE (auto-set, bất kể user chọn gì)
  ├── courseId: "clx..."
  └── Chỉ enrolled students mới join được
```

### 2.3 Auto-PRIVATE cho course groups

```typescript
async create(ownerId: string, dto: CreateGroupDto) {
  return this.prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: dto.name,
        ownerId,
        courseId: dto.courseId,
        // Nếu có courseId → LUÔN PRIVATE, bất kể dto.privacy
        privacy: dto.courseId ? 'PRIVATE' : (dto.privacy ?? 'PUBLIC'),
      },
    });

    // Owner tự động thành member OWNER
    await tx.groupMember.create({
      data: { groupId: group.id, userId: ownerId, role: 'OWNER' },
    });

    return group;
  });
}
```

**Tại sao auto-PRIVATE?**
- Course group = nơi thảo luận nội dung khóa học
- Chỉ enrolled students nên truy cập → phải PRIVATE
- Instructor có thể quên set privacy → auto-set để an toàn

### 2.4 Course unique constraint

```prisma
model Group {
  courseId String? @unique @map("course_id")
}
```

**`@unique` đảm bảo 1 course = 1 group.** Nếu instructor tạo group thứ 2 cho cùng course → ConflictException.

---

## 3. JOIN — Enrollment Check

```typescript
async join(groupId: string, userId: string) {
  const group = await this.prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

  // Gate 1: Private course group → check enrollment
  if (group.privacy === 'PRIVATE' && group.courseId) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { userId, courseId: group.courseId },
    });
    if (!enrollment) {
      throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
    }
  }

  // Gate 2: Already member check
  const existing = await this.prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_MEMBER' });

  // Join + increment counter
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
```

**Join flow:**
```
User clicks "Join Group"
  │
  ├── PUBLIC group? → Join immediately
  │
  └── PRIVATE + courseId?
      ├── Has enrollment → Join
      └── No enrollment → 403 ENROLLMENT_REQUIRED
          → Frontend: "Bạn cần mua khóa học này để tham gia nhóm"
```

---

## 4. ROLE HIERARCHY

### 4.1 GroupRole enum

```prisma
enum GroupRole {
  OWNER    // Creator, full control
  ADMIN    // Promoted by owner, can manage members
  MEMBER   // Regular member
}
```

### 4.2 Permission matrix

| Action | OWNER | ADMIN | MEMBER |
|--------|-------|-------|--------|
| View posts | ✅ | ✅ | ✅ |
| Create post | ✅ | ✅ | ✅ |
| Update group | ✅ | ✅ | ❌ |
| Delete group | ✅ | ❌ | ❌ |
| Change member role | ✅ | ✅ | ❌ |
| Kick member | ✅ | ✅ | ❌ |
| Leave group | ❌ | ✅ | ✅ |
| Be kicked | ❌ | ✅* | ✅ |

*Admin can be kicked by Owner only

### 4.3 verifyGroupRole helper

```typescript
private async verifyGroupRole(
  groupId: string,
  userId: string,
  allowedRoles: GroupRole[],
) {
  const member = await this.prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member || !allowedRoles.includes(member.role)) {
    throw new ForbiddenException({ code: 'INSUFFICIENT_GROUP_ROLE' });
  }
  return member;
}
```

**Usage:**
```typescript
// Owner only
await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER]);

// Owner or Admin
await this.verifyGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);
```

### 4.4 Owner cannot leave

```typescript
async leave(groupId: string, userId: string) {
  const member = await this.prisma.groupMember.findUnique({...});
  if (member.role === 'OWNER') {
    throw new ForbiddenException({ code: 'OWNER_CANNOT_LEAVE' });
  }
  // ...
}
```

**Tại sao?**
- Group phải luôn có ít nhất 1 owner
- Nếu owner leave → group orphaned (không ai quản lý được)
- Owner muốn rời: xóa group hoặc transfer ownership (chưa implement)

---

## 5. CONTROLLER — GroupsController

### 12 endpoints

```
@Controller('groups')

GET    /api/groups                          @Public()  → findAll(query)
POST   /api/groups                                     → create(user, dto)
GET    /api/groups/:id                      @Public()  → findById(id, user?)
PUT    /api/groups/:id                                 → update(id, user, dto)
DELETE /api/groups/:id                                 → delete(id, user)
POST   /api/groups/:id/join                            → join(id, user)
POST   /api/groups/:id/leave                           → leave(id, user)
GET    /api/groups/:id/members                         → getMembers(id, query)
PUT    /api/groups/:id/members/:userId                 → updateMemberRole(...)
DELETE /api/groups/:id/members/:userId                 → kickMember(...)
GET    /api/groups/:id/posts                           → getGroupPosts(...)
POST   /api/groups/:id/posts                           → createGroupPost(...)
```

### Group post creation — Reuse PostsService

```typescript
@Post(':id/posts')
async createGroupPost(
  @Param('id', ParseCuidPipe) id: string,
  @CurrentUser() user: JwtPayload,
  @Body() dto: CreatePostDto,
) {
  dto.groupId = id;  // Set groupId from path param
  return this.postsService.create(user.sub, dto);
}
```

**Tại sao không tạo method riêng?**
- PostsService.create đã handle groupId (fanout to group members)
- DRY — không duplicate logic
- Controller chỉ "inject" groupId vào DTO rồi delegate

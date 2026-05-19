# Giải thich chi tiet Phase 5.13g — Groups (Nhom)

> Tai lieu giai thich day du tinh nang Groups trong he thong Social cua SSLM.
> Bao gom: mo hinh du lieu, phan quyen, cac flow nghiep vu, va chi tiet thay doi code tren toan bo 3 tang (backend, shared, frontend).

---

## 1. Tong quan tinh nang Groups

Groups la tinh nang cho phep nguoi dung tao va tham gia cac nhom hoc tap/thao luan. Day la mot phan cot loi cua mang xa hoi hoc tap (Social Learning), giup sinh vien ket noi, chia se kien thuc, va thao luan theo chu de.

### 1.1 Cac kha nang chinh

| Kha nang | Mo ta |
|----------|-------|
| **Browse Groups** | Xem danh sach nhom, tim kiem theo ten, phan trang |
| **Create Group** | Tao nhom moi (PUBLIC hoac PRIVATE), co the gan voi khoa hoc |
| **Join/Leave** | Tham gia nhom cong khai truc tiep, nhom rieng tu gui yeu cau |
| **Group Detail** | Xem thong tin nhom, bai viet, thanh vien, yeu cau tham gia |
| **Post in Group** | Thanh vien dang bai viet trong nhom, like/comment/share |
| **Manage Members** | Owner/Admin thay doi role, kick thanh vien |
| **Join Requests** | Owner/Admin duyet hoac tu choi yeu cau tham gia nhom rieng tu |
| **Course-linked Group** | Nhom gan voi khoa hoc — tu dong PRIVATE, chi hoc vien duoc tham gia |

### 1.2 Kien truc tong the

```
Frontend (student-portal)         Shared Layer              Backend (NestJS API)
========================         ============              ====================
GroupsPage (browse)        -->   useGroups()          -->  GET /groups
CreateGroupDialog          -->   useCreateGroup()     -->  POST /groups
GroupDetailPage             -->   useGroup()           -->  GET /groups/:id
  GroupHeader                    useJoinGroup()       -->  POST /groups/:id/join
  GroupPostsTab             -->   useGroupPosts()      -->  GET /groups/:id/posts
  GroupMembersTab           -->   useGroupMembers()    -->  GET /groups/:id/members
  GroupRequestsTab          -->   useJoinRequests()    -->  GET /groups/:id/requests
MemberItem                  -->   useUpdateMemberRole()-->  PUT /groups/:id/members/:userId
                                 useKickMember()      -->  DELETE /groups/:id/members/:userId
```

---

## 2. Mo hinh du lieu (Prisma Schema)

### 2.1 Ba model chinh

```prisma
model Group {
  id          String       @id @default(cuid())
  name        String
  description String?
  avatarUrl   String?      @map("avatar_url")
  ownerId     String       @map("owner_id")
  courseId     String?      @unique @map("course_id")
  privacy     GroupPrivacy  @default(PUBLIC)
  memberCount Int          @default(1) @map("member_count")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  owner        User              @relation(...)
  course       Course?           @relation(...)
  members      GroupMember[]
  posts        Post[]
  joinRequests GroupJoinRequest[]

  @@index([ownerId])
  @@map("groups")
}

model GroupMember {
  id      String    @id @default(cuid())
  groupId String    @map("group_id")
  userId  String    @map("user_id")
  role    GroupRole  @default(MEMBER)
  createdAt DateTime @default(now()) @map("created_at")

  group Group @relation(..., onDelete: Cascade)
  user  User  @relation(..., onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([userId])
  @@map("group_members")
}

model GroupJoinRequest {
  id      String            @id @default(cuid())
  groupId String            @map("group_id")
  userId  String            @map("user_id")
  status  JoinRequestStatus @default(PENDING)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  group Group @relation(..., onDelete: Cascade)
  user  User  @relation(..., onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([groupId, status])
  @@map("group_join_requests")
}
```

### 2.2 Cac enum lien quan

```prisma
enum GroupRole {
  OWNER    // Nguoi tao nhom, quyen cao nhat
  ADMIN    // Quan tri vien, duoc Owner bo nhiem
  MEMBER   // Thanh vien thuong
}

enum GroupPrivacy {
  PUBLIC   // Ai cung co the xem va tham gia
  PRIVATE  // Can yeu cau hoac la hoc vien cua khoa hoc
}

enum JoinRequestStatus {
  PENDING   // Dang cho duyet
  APPROVED  // Da duoc chap nhan
  REJECTED  // Da bi tu choi
}
```

### 2.3 Cac diem thiet ke dang chu y

1. **`memberCount` la denormalized field**: Thay vi `COUNT(*)` moi lan, luu san so thanh vien va cap nhat bang transaction khi join/leave/kick. Giup toi uu hoa query danh sach nhom.

2. **`courseId` la unique**: Moi khoa hoc chi co the co mot nhom duy nhat. Khi tao nhom voi `courseId`, nhom tu dong la PRIVATE.

3. **`@@unique([groupId, userId])` tren GroupMember va GroupJoinRequest**: Dam bao moi user chi co mot record membership va mot record request cho moi nhom.

4. **`@@index([groupId, status])` tren GroupJoinRequest**: Toi uu query lay danh sach requests PENDING cho mot nhom cu the.

5. **Cascade delete**: Khi xoa Group, tat ca GroupMember va GroupJoinRequest bi xoa theo.

---

## 3. He thong phan quyen

### 3.1 Ba cap do role trong nhom

```
OWNER > ADMIN > MEMBER
```

| Hanh dong | OWNER | ADMIN | MEMBER | Non-member |
|-----------|-------|-------|--------|------------|
| Xem nhom PUBLIC | V | V | V | V |
| Xem bai viet nhom PUBLIC | V | V | V | V |
| Xem bai viet nhom PRIVATE | V | V | V | X |
| Tham gia nhom | - | - | - | V |
| Dang bai trong nhom | V | V | V | X |
| Xem danh sach thanh vien | V | V | V | V |
| Thay doi role thanh vien | V | V | X | X |
| Kick thanh vien | V | V | X | X |
| Duyet/tu choi yeu cau | V | V | X | X |
| Cap nhat thong tin nhom | V | V | X | X |
| Xoa nhom | V | X | X | X |
| Roi nhom | X | V | V | X |

### 3.2 Cac rang buoc dac biet

1. **OWNER khong the roi nhom**: Phai xoa nhom hoac (tuong lai) chuyen quyen OWNER cho nguoi khac.
2. **Khong the thay doi role cua OWNER**: `CANNOT_CHANGE_OWNER_ROLE` error.
3. **Khong the kick OWNER**: `CANNOT_KICK_OWNER` error.
4. **ADMIN co the thay doi role va kick MEMBER**: Nhung khong the tac dong len OWNER.

### 3.3 Cach verify quyen trong backend

Service su dung hai helper method:

```typescript
// Kiem tra user co role phu hop khong
private async verifyGroupRole(groupId: string, userId: string, allowedRoles: GroupRole[]) {
  const member = await this.prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member || !allowedRoles.includes(member.role)) {
    throw new ForbiddenException({ code: 'INSUFFICIENT_GROUP_ROLE' });
  }
  return member;
}

// Kiem tra user co phai thanh vien khong (bat ky role nao)
private async verifyGroupMember(groupId: string, userId: string) {
  const member = await this.prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw new ForbiddenException({ code: 'NOT_GROUP_MEMBER' });
  return member;
}
```

**Diem chu y**: Su dung composite unique key `groupId_userId` de query, giup Prisma tao WHERE clause hieu qua voi unique index.

---

## 4. Cac flow nghiep vu chi tiet

### 4.1 Browse Groups (Danh sach nhom)

```
User mo trang /social/groups
  --> Frontend goi useGroups({ search, page, limit })
    --> GET /groups?search=...&page=1&limit=12
      --> GroupsService.findAll()
        1. Build WHERE clause tu search (ILIKE tren name)
        2. Query groups + count (Promise.all)
        3. Neu co currentUserId:
           a. Batch query GroupMember cho tat ca groupIds
           b. Batch query GroupJoinRequest cho tat ca groupIds
           c. Map thanh enriched response voi isMember, currentUserRole, joinRequestStatus
        4. Tra ve paginated result
```

**Ky thuat Batch Lookup**: Thay vi N+1 query (moi nhom mot query kiem tra membership), service dung `findMany` voi `{ in: groupIds }` de lay tat ca membership/request trong 2 query duy nhat, roi dung Map de merge.

```typescript
const [memberships, requests] = await Promise.all([
  this.prisma.groupMember.findMany({
    where: { groupId: { in: groupIds }, userId: currentUserId },
    select: { groupId: true, role: true },
  }),
  this.prisma.groupJoinRequest.findMany({
    where: { groupId: { in: groupIds }, userId: currentUserId },
    select: { groupId: true, status: true },
  }),
]);
const memberMap = new Map(memberships.map((m) => [m.groupId, m.role]));
const requestMap = new Map(requests.map((r) => [r.groupId, r.status]));
```

### 4.2 Create Group (Tao nhom)

```
User bam "Create Group"
  --> Mo CreateGroupDialog
    --> Nhap name, description, chon privacy (PUBLIC/PRIVATE)
    --> Bam Create
      --> useCreateGroup().mutate(data)
        --> POST /groups { name, description, privacy }
          --> GroupsService.create(ownerId, dto)
            1. Neu co courseId: kiem tra da co nhom chua (ConflictException)
            2. Transaction:
               a. Tao Group record
               b. Tao GroupMember { role: OWNER } cho nguoi tao
            3. Tra ve Group object
```

**Luu y ve Course-linked Group**:
- Khi `courseId` duoc truyen, privacy tu dong la `'PRIVATE'` bat ke gia tri privacy trong DTO.
- Logic: `privacy: dto.courseId ? 'PRIVATE' : (dto.privacy ?? 'PUBLIC')`
- Moi course chi co duy nhat mot group (`courseId` co `@unique`).

### 4.3 Join Group — State Machine

Day la flow phuc tap nhat, xu ly 4 truong hop:

```
                        join()
                          |
                    [Check group exists]
                          |
                    [Check already member?]
                     /          \
                  Yes            No
                   |              |
            ConflictException   [Check privacy]
                               /          \
                         PUBLIC          PRIVATE
                           |                |
                      Direct Join      [Has courseId?]
                                       /          \
                                    Yes            No
                                     |              |
                              [Has enrollment?]   [Create/Update JoinRequest]
                               /          \           |
                            Yes            No      { requested: true }
                             |              |        + Notify owner
                        Direct Join   ForbiddenException
                                      ENROLLMENT_REQUIRED
```

**Code chi tiet cua join():**

```typescript
async join(groupId: string, userId: string) {
  // 1. Kiem tra group ton tai
  const group = await this.prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

  // 2. Kiem tra da la thanh vien chua
  const existingMember = await this.prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existingMember) throw new ConflictException({ code: 'ALREADY_MEMBER' });

  // 3. Xu ly nhom rieng tu
  if (group.privacy === 'PRIVATE') {
    if (group.courseId) {
      // 3a. Nhom gan khoa hoc: kiem tra enrollment
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { userId, courseId: group.courseId },
      });
      if (!enrollment) throw new ForbiddenException({ code: 'ENROLLMENT_REQUIRED' });
      // Fall through to direct join
    } else {
      // 3b. Nhom rieng tu thuong: tao join request
      const existingRequest = await this.prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (existingRequest?.status === 'PENDING') {
        throw new ConflictException({ code: 'JOIN_REQUEST_PENDING' });
      }
      // Upsert: neu da bi REJECTED truoc do, chuyen lai thanh PENDING
      await this.prisma.groupJoinRequest.upsert({
        where: { groupId_userId: { groupId, userId } },
        update: { status: 'PENDING' },
        create: { groupId, userId, status: 'PENDING' },
      });
      // Gui notification cho owner
      this.notifications.create(group.ownerId, 'SYSTEM', {
        type: 'GROUP_JOIN_REQUEST', groupId, groupName: group.name, userId,
      }).catch(() => {});
      return { requested: true };
    }
  }

  // 4. Tham gia truc tiep (public hoac course-linked private co enrollment)
  await this.prisma.$transaction([
    this.prisma.groupMember.create({ data: { groupId, userId, role: 'MEMBER' } }),
    this.prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    }),
  ]);
  return { joined: true };
}
```

**Cac diem dac biet cua Join Request state machine:**

1. **Upsert pattern**: Dung `upsert` de xu ly truong hop user da bi reject truoc do nhung muon gui lai yeu cau. Thay vi tao record moi, cap nhat status ve PENDING.
2. **Fire-and-forget notification**: Dung `.catch(() => {})` de khong block response neu notification fail.
3. **Transaction cho direct join**: Dam bao GroupMember duoc tao va memberCount duoc tang trong cung mot transaction.

### 4.4 Leave Group

```
User bam "Leave" tren GroupHeader
  --> useLeaveGroup().mutate(groupId)
    --> POST /groups/:id/leave
      --> GroupsService.leave()
        1. Kiem tra la thanh vien (NotFoundException neu khong phai)
        2. Kiem tra role != OWNER (ForbiddenException: OWNER_CANNOT_LEAVE)
        3. Transaction:
           a. Xoa GroupMember record
           b. Giam memberCount
        4. Tra ve { left: true }
```

### 4.5 Group Detail Page

```
User vao /social/groups/[groupId]
  --> useGroup(groupId)
    --> GET /groups/:id
      --> GroupsService.findById()
        1. Query group voi owner info va member count
        2. Neu co currentUserId:
           a. Kiem tra GroupMember (lay isMember va currentUserRole)
           b. Kiem tra GroupJoinRequest (lay joinRequestStatus)
        3. Tra ve enriched group data

  --> Render GroupHeader (ten, avatar, privacy badge, join/leave button)
  --> Render Tabs:
       - Posts (GroupPostsTab): danh sach bai viet + composer
       - Members (GroupMembersTab): danh sach thanh vien
       - Requests (GroupRequestsTab): chi hien cho OWNER/ADMIN
       - About: mo ta, ngay tao
```

### 4.6 Group Posts

```
GroupPostsTab
  --> useGroupPosts(groupId, { page, limit })
    --> GET /groups/:id/posts
      --> GroupsService.getGroupPosts()
        1. Kiem tra privacy:
           - PUBLIC: ai cung xem duoc
           - PRIVATE: chi member moi xem duoc (verifyGroupMember)
        2. Query posts voi author, images
        3. Batch lookup isLiked, isBookmarked cho currentUser
        4. Tra ve paginated enriched posts

  --> Neu isMember: hien PostComposer (textarea + nut gui)
    --> useCreateGroupPost().mutate({ groupId, data: { content } })
      --> POST /groups/:id/posts
        --> PostsService.create() (reuse logic tu social posts, dto.groupId = id)
```

### 4.7 Manage Members

```
GroupMembersTab (canManage = isOwnerOrAdmin)
  --> useGroupMembers(groupId, { page, limit })
    --> GET /groups/:id/members
      --> GroupsService.getMembers(): query voi user info, phan trang

  --> Moi MemberItem hien thi:
       - Avatar, ten, role badge (Crown cho OWNER, Shield cho ADMIN)
       - Neu canManage va khong phai OWNER:
         * Select dropdown thay doi role (MEMBER <-> ADMIN)
         * Nut kick (voi ConfirmDialog)

  --> Thay doi role:
       useUpdateMemberRole().mutate({ groupId, userId, role })
         --> PUT /groups/:id/members/:userId { role }
           --> GroupsService.updateMemberRole()
             1. verifyGroupRole (OWNER hoac ADMIN)
             2. Kiem tra target ton tai
             3. Kiem tra target khong phai OWNER
             4. Cap nhat role

  --> Kick thanh vien:
       useKickMember().mutate({ groupId, userId })
         --> DELETE /groups/:id/members/:userId
           --> GroupsService.kickMember()
             1. verifyGroupRole (OWNER hoac ADMIN)
             2. Kiem tra target ton tai
             3. Kiem tra target khong phai OWNER
             4. Transaction: xoa member + giam memberCount
```

### 4.8 Join Requests (Chi danh cho OWNER/ADMIN)

```
GroupRequestsTab
  --> useJoinRequests(groupId, { page, limit })
    --> GET /groups/:id/requests
      --> GroupsService.getJoinRequests()
        1. verifyGroupRole (OWNER hoac ADMIN)
        2. Query requests co status = PENDING, voi user info
        3. Tra ve paginated result

  --> Moi request hien thi:
       - Avatar, ten, thoi gian gui yeu cau
       - Nut Approve va Reject

  --> Approve:
       useApproveRequest().mutate({ groupId, requestId })
         --> PUT /groups/:id/requests/:requestId/approve
           --> GroupsService.approveJoinRequest()
             1. verifyGroupRole
             2. Kiem tra request ton tai va thuoc nhom nay
             3. Kiem tra status la PENDING (ConflictException neu da xu ly)
             4. Transaction:
                a. Cap nhat request status = APPROVED
                b. Tao GroupMember { role: MEMBER }
                c. Tang memberCount
             5. Gui notification cho nguoi gui yeu cau (GROUP_JOIN_APPROVED)

  --> Reject:
       useRejectRequest().mutate({ groupId, requestId })
         --> PUT /groups/:id/requests/:requestId/reject
           --> GroupsService.rejectJoinRequest()
             1. verifyGroupRole
             2. Kiem tra request ton tai va thuoc nhom nay
             3. Kiem tra status la PENDING
             4. Cap nhat request status = REJECTED
```

---

## 5. Chi tiet thay doi code

### 5.1 Backend (NestJS API)

#### 5.1.1 Prisma Schema & Migration

| File | Thay doi |
|------|----------|
| `apps/api/src/prisma/schema.prisma` | Them model `GroupJoinRequest`, enum `JoinRequestStatus`, them relation `joinRequests` tren model `Group` |
| `apps/api/src/prisma/migrations/20260324135459_add_group_join_request/migration.sql` | Tao bang `group_join_requests`, indexes, foreign keys |

#### 5.1.2 DTOs

| File | Noi dung |
|------|----------|
| `apps/api/src/modules/social/dto/create-group.dto.ts` | Validate: name (3-100 chars), description (<=500), privacy (enum), courseId (optional) |
| `apps/api/src/modules/social/dto/update-group.dto.ts` | Validate: name, description, avatarUrl — tat ca optional |
| `apps/api/src/modules/social/dto/query-groups.dto.ts` | Ke thua PaginationDto, them search (optional string) |

#### 5.1.3 Controller (groups.controller.ts)

15 endpoints duoc dinh nghia:

| Method | Endpoint | Auth | Mo ta |
|--------|----------|------|-------|
| `GET` | `/groups` | Public | Danh sach nhom (co enriched data neu dang nhap) |
| `POST` | `/groups` | Bearer | Tao nhom moi |
| `GET` | `/groups/:id` | Public | Chi tiet nhom |
| `PUT` | `/groups/:id` | Bearer | Cap nhat nhom (OWNER/ADMIN) |
| `DELETE` | `/groups/:id` | Bearer | Xoa nhom (OWNER) |
| `POST` | `/groups/:id/join` | Bearer | Tham gia nhom |
| `POST` | `/groups/:id/leave` | Bearer | Roi nhom |
| `GET` | `/groups/:id/members` | Public | Danh sach thanh vien |
| `PUT` | `/groups/:id/members/:userId` | Bearer | Thay doi role (OWNER/ADMIN) |
| `DELETE` | `/groups/:id/members/:userId` | Bearer | Kick thanh vien (OWNER/ADMIN) |
| `GET` | `/groups/:id/requests` | Bearer | Danh sach yeu cau (OWNER/ADMIN) |
| `PUT` | `/groups/:id/requests/:requestId/approve` | Bearer | Duyet yeu cau (OWNER/ADMIN) |
| `PUT` | `/groups/:id/requests/:requestId/reject` | Bearer | Tu choi yeu cau (OWNER/ADMIN) |
| `GET` | `/groups/:id/posts` | Public | Bai viet trong nhom |
| `POST` | `/groups/:id/posts` | Bearer | Dang bai trong nhom |

**Diem dac biet**: Endpoint `POST /groups/:id/posts` su dung `PostsService.create()` da co san, chi them `dto.groupId = id` truoc khi goi — tai su dung logic tao bai viet tu module social.

#### 5.1.4 Service (groups.service.ts)

- **11 public methods**: create, findAll, findById, update, delete, join, leave, getMembers, updateMemberRole, kickMember, getGroupPosts, getJoinRequests, approveJoinRequest, rejectJoinRequest
- **2 private helpers**: verifyGroupRole, verifyGroupMember
- **Inject dependencies**: PrismaService, NotificationsService

#### 5.1.5 Unit Tests (groups.service.spec.ts)

10 test cases bao phu:
- `create`: tao nhom binh thuong, tu dong PRIVATE cho course group, conflict khi course group da ton tai
- `join`: tham gia nhom public, yeu cau enrollment cho private course group, conflict khi da la thanh vien
- `leave`: roi nhom binh thuong, chan owner roi nhom, not found khi khong phai thanh vien
- `kickMember`: kick thanh cong, chan kick owner

---

### 5.2 Shared Layer (packages/shared-hooks)

#### 5.2.1 Group Service (services/group.service.ts)

API client wrapper voi cac method:

```typescript
export const groupService = {
  // CRUD
  getGroups, createGroup, getGroup, updateGroup, deleteGroup,
  // Membership
  joinGroup, leaveGroup,
  // Members
  getMembers, updateMemberRole, kickMember,
  // Posts
  getGroupPosts, createGroupPost,
  // Join Requests
  getJoinRequests, approveRequest, rejectRequest,
};
```

Moi method goi `apiClient.get/post/put/del` voi endpoint tuong ung. Su dung helper `toQuery()` de chuyen params thanh query string (loai bo null/undefined/empty values).

#### 5.2.2 React Query Hooks (queries/use-groups.ts)

**5 Query hooks:**

| Hook | Query Key | Description |
|------|-----------|-------------|
| `useGroups(params)` | `['groups', params]` | Danh sach nhom voi search/pagination |
| `useGroup(id)` | `['groups', id]` | Chi tiet mot nhom |
| `useGroupMembers(id, params)` | `['groups', id, 'members', params]` | Danh sach thanh vien |
| `useGroupPosts(id, params)` | `['groups', id, 'posts', params]` | Bai viet trong nhom |
| `useJoinRequests(id, params)` | `['groups', id, 'requests', params]` | Yeu cau tham gia (PENDING) |

**10 Mutation hooks:**

| Hook | Invalidates | Description |
|------|-------------|-------------|
| `useCreateGroup` | `['groups']` | Tao nhom moi |
| `useUpdateGroup` | `['groups', id]`, `['groups']` | Cap nhat nhom |
| `useDeleteGroup` | `['groups']` | Xoa nhom |
| `useJoinGroup` | `['groups', id]`, `['groups']` | Tham gia nhom |
| `useLeaveGroup` | `['groups', id]`, `['groups']` | Roi nhom |
| `useCreateGroupPost` | `['groups', groupId, 'posts']` | Dang bai trong nhom |
| `useUpdateMemberRole` | `['groups', groupId, 'members']` | Thay doi role |
| `useKickMember` | `['groups', groupId, 'members']`, `['groups', groupId]` | Kick thanh vien |
| `useApproveRequest` | `['groups', groupId, 'requests']`, `['groups', groupId, 'members']`, `['groups', groupId]` | Duyet yeu cau |
| `useRejectRequest` | `['groups', groupId, 'requests']` | Tu choi yeu cau |

**Mau invalidation thong minh**: Khi approve request, ca 3 query key bi invalidate (requests giam, members tang, group detail cap nhat memberCount). Khi reject, chi invalidate requests.

---

### 5.3 Frontend (student-portal)

#### 5.3.1 Pages

| File | Route | Chuc nang |
|------|-------|-----------|
| `apps/student-portal/src/app/[locale]/(main)/social/groups/page.tsx` | `/social/groups` | Browse groups: search, grid 3 cot, pagination so trang |
| `apps/student-portal/src/app/[locale]/(main)/social/groups/[groupId]/page.tsx` | `/social/groups/:groupId` | Group detail: header + 4 tabs (Posts, Members, Requests, About) |

#### 5.3.2 Components

| Component | File | Chuc nang |
|-----------|------|-----------|
| **GroupCard** | `components/social/group-card.tsx` | Card hien thi nhom trong danh sach: avatar, ten, so thanh vien, privacy badge, nut Join/Joined/Request Sent |
| **GroupHeader** | `components/social/group-header.tsx` | Header trang chi tiet nhom: banner gradient, avatar lon, thong tin, nut Join/Leave/Owner |
| **GroupPostsTab** | `components/social/group-posts-tab.tsx` | Tab bai viet: composer (chi cho member) + danh sach GroupPostCard |
| **GroupPostCard** | `components/social/group-post-card.tsx` | Card bai viet: author, content, images, PostActions (like/comment/share), CommentSection |
| **GroupMembersTab** | `components/social/group-members-tab.tsx` | Tab thanh vien: danh sach MemberItem voi pagination |
| **MemberItem** | `components/social/member-item.tsx` | Card thanh vien: avatar, ten, role badge, role selector (neu canManage), nut kick |
| **GroupRequestsTab** | `components/social/group-requests-tab.tsx` | Tab yeu cau: danh sach requests PENDING voi nut Approve/Reject |
| **CreateGroupDialog** | `components/social/create-group-dialog.tsx` | Dialog tao nhom: form voi name, description, privacy selector |

---

## 6. Ky thuat dac biet

### 6.1 Join Request State Machine

Trang thai cua mot join request thay doi theo diagram:

```
(Khong co request)
       |
       | User bam "Request to Join"
       v
    PENDING -----> APPROVED (tao GroupMember)
       |                |
       | Admin reject    | (User da la member,
       v                 |  khong can request nua)
    REJECTED             v
       |            (Thanh vien nhom)
       | User gui lai yeu cau (upsert)
       v
    PENDING (quay lai)
```

**Diem dac biet cua upsert**: Khi user da bi reject va muon gui lai yeu cau, dung `upsert` de cap nhat record cu thay vi tao moi (vi co unique constraint `[groupId, userId]`).

### 6.2 Privacy Check cho Group Posts

```typescript
async getGroupPosts(groupId, userId, query) {
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
    select: { privacy: true },
  });
  if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND' });

  // PUBLIC: ai cung xem duoc, ke ca anonymous
  // PRIVATE: bat buoc phai la thanh vien
  if (group.privacy === 'PRIVATE') {
    if (!userId) throw new ForbiddenException({ code: 'NOT_GROUP_MEMBER' });
    await this.verifyGroupMember(groupId, userId);
  }
  // ... fetch posts
}
```

- Nhom PUBLIC: endpoint la `@Public()`, ai cung xem duoc bai viet.
- Nhom PRIVATE: phai dang nhap VA la thanh vien moi xem duoc.

### 6.3 Role-based UI Rendering

Frontend su dung cac bien boolean de quyet dinh UI:

```typescript
// Trong GroupDetailPage
const isMember = group?.isMember === true;
const isOwnerOrAdmin = group?.userRole === 'OWNER' || group?.userRole === 'ADMIN';

// Conditional rendering:
// 1. Tab Requests chi hien cho OWNER/ADMIN
{isOwnerOrAdmin && <TabsTrigger value="requests">{t('requests')}</TabsTrigger>}

// 2. Post composer chi hien cho members
<GroupPostsTab groupId={groupId} isMember={isMember} />

// 3. Member management controls chi hien cho OWNER/ADMIN
<GroupMembersTab groupId={groupId} canManage={isOwnerOrAdmin} />
```

Trong `GroupHeader`, nut action thay doi theo trang thai:
- **Owner**: Hien label "Owner" voi icon check (khong co nut leave)
- **Member (khong phai owner)**: Hien nut "Leave"
- **Pending request**: Hien nut "Request Sent" (disabled)
- **Non-member, nhom PUBLIC**: Hien nut "Join"
- **Non-member, nhom PRIVATE**: Hien nut "Request to Join"

### 6.4 Batch Enrichment Pattern

Thay vi N+1 query, dung batch lookup:

```typescript
// Trong findAll: enrichment cho danh sach nhom
if (currentUserId && groups.length > 0) {
  const groupIds = groups.map(g => g.id);
  // 2 queries thay vi 2*N queries
  const [memberships, requests] = await Promise.all([...]);
  const memberMap = new Map(...);
  const requestMap = new Map(...);
  // O(1) lookup cho moi group
  const enriched = groups.map(g => ({
    ...g,
    isMember: memberMap.has(g.id),
    currentUserRole: memberMap.get(g.id) ?? null,
    joinRequestStatus: requestMap.get(g.id) ?? null,
  }));
}

// Trong getGroupPosts: enrichment cho like/bookmark
if (userId && posts.length > 0) {
  const postIds = posts.map(p => p.id);
  const [likes, bookmarks] = await Promise.all([...]);
  const likedSet = new Set(likes.map(l => l.postId));
  const bookmarkedSet = new Set(bookmarks.map(b => b.postId));
  // O(1) lookup cho moi post
}
```

### 6.5 Notification Integration

Hai loai notification duoc gui:

1. **GROUP_JOIN_REQUEST**: Gui cho owner khi co nguoi gui yeu cau tham gia nhom rieng tu.
2. **GROUP_JOIN_APPROVED**: Gui cho nguoi gui yeu cau khi duoc duyet.

Ca hai deu dung fire-and-forget pattern (`.catch(() => {})`) de khong block response.

### 6.6 Denormalized memberCount

`memberCount` duoc cap nhat trong transaction cung voi viec them/xoa member:

```typescript
// Join
await this.prisma.$transaction([
  this.prisma.groupMember.create({ data: { groupId, userId, role: 'MEMBER' } }),
  this.prisma.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } }),
]);

// Leave / Kick
await this.prisma.$transaction([
  this.prisma.groupMember.delete({ where: { id: member.id } }),
  this.prisma.group.update({ where: { id: groupId }, data: { memberCount: { decrement: 1 } } }),
]);

// Approve request
await this.prisma.$transaction([
  this.prisma.groupJoinRequest.update({ ... status: 'APPROVED' }),
  this.prisma.groupMember.create({ data: { groupId, userId: request.userId, role: 'MEMBER' } }),
  this.prisma.group.update({ where: { id: groupId }, data: { memberCount: { increment: 1 } } }),
]);
```

Moi thao tac thay doi so thanh vien deu nam trong transaction de dam bao consistency.

---

## 7. Tong ket

### 7.1 So lieu thay doi

| Tang | So files | Chi tiet |
|------|----------|----------|
| **Backend** | ~7 files | schema, migration, 3 DTOs, controller, service, test |
| **Shared** | 2 files | group.service.ts, use-groups.ts |
| **Frontend** | ~10 files | 2 pages, 8 components |

### 7.2 Cac diem noi bat cua thiet ke

1. **Tinh nhat quan**: Tat ca mutation deu dung TanStack Query voi proper cache invalidation.
2. **Bao mat nhieu tang**: Controller dung `@Public()` / `@ApiBearerAuth()`, Service dung `verifyGroupRole()` / `verifyGroupMember()`.
3. **Toi uu hieu nang**: Batch lookup thay vi N+1, denormalized memberCount, composite indexes.
4. **UX tot**: Loading states (Loader2), empty states, confirm dialog truoc khi kick, debounced search.
5. **Reusable**: Group posts tai su dung `PostsService.create()`, `PostActions`, `CommentSection`, `ShareDialog` tu social module.
6. **i18n day du**: Tat ca user-facing strings dung `useTranslations('groups')`.

# 01 — Uploads & Media: Client-Side Signed Upload, Media Records, Counter Recalculation

> Giải thích chi tiết kiến trúc upload — tại sao dùng client-side signed upload thay vì server-side,
> MediaService với ownership verification chain, counter recalculation cascade,
> và circular dependency resolution với forwardRef.

---

## 1. TỔNG QUAN

### 1.1 Vấn đề

SSLM cần upload nhiều loại file:
- **Video** — bài giảng (có thể 500MB+)
- **Image** — avatar, thumbnail, post images
- **Attachment** — PDF, Word, Excel cho lesson attachments

### 1.2 Kiến trúc — 2 Layers

```
UploadsModule (Infrastructure)         MediaModule (Business Logic)
├── UploadsService                     ├── MediaService
│   ├── generateSignedUploadParams()   │   ├── signAndCreatePending()
│   ├── deleteFile()                   │   ├── completeUpload()
│   └── getVideoInfo()                 │   ├── deleteMedia()
├── UploadsController                  │   ├── getByLessonId()
│   ├── POST /api/uploads/sign         │   ├── verifyLessonOwnership()
│   ├── POST /api/uploads/:id/complete │   └── recalculateCounters()
│   └── DELETE /api/uploads/:id        └── DTOs
└── Cloudinary SDK                         ├── SignUploadDto
                                           └── CompleteUploadDto
```

**Tại sao tách 2 module?**
- `UploadsService` — **infrastructure layer**: chỉ biết về Cloudinary API (sign, delete, getInfo). Không biết về business logic.
- `MediaService` — **domain layer**: biết về Media records, ownership, counters. Gọi UploadsService khi cần interact với Cloudinary.

Separation of concerns: nếu sau này đổi từ Cloudinary sang S3, chỉ sửa UploadsService.

---

## 2. CLIENT-SIDE SIGNED UPLOAD

### 2.1 Tại sao không upload qua backend?

```
❌ Server-Side Upload:
┌──────────┐     500MB     ┌──────────┐     500MB     ┌────────────┐
│  Browser  │──────────────→│  Backend  │──────────────→│ Cloudinary │
└──────────┘               └──────────┘               └────────────┘
                           RAM: 512MB (Render free)
                           → Buffer 500MB video → OOM crash
                           → Upload time = 2x (client→server + server→cloud)
                           → Bandwidth = 2x (server phải receive + send)

✅ Client-Side Signed Upload:
┌──────────┐  1KB (sign)   ┌──────────┐
│  Browser  │──────────────→│  Backend  │ ← Chỉ xử lý metadata
└──────────┘               └──────────┘
      │                         │
      │     500MB (direct)      │  1KB (signature)
      ▼                         ▼
┌────────────┐
│ Cloudinary │ ← Nhận file trực tiếp từ browser
└────────────┘
                           → Backend RAM: ~0 (chỉ 1KB JSON)
                           → Upload time = 1x (client→cloud trực tiếp)
                           → Phù hợp Render.com free tier (512MB RAM)
```

### 2.2 Cloudinary Signed Upload — Lý thuyết

**Vấn đề bảo mật:** Nếu để browser upload trực tiếp → cần expose API secret → ai cũng upload được.

**Giải pháp:** Backend ký (sign) upload params bằng API secret, browser gửi signature kèm file. Cloudinary verify signature → chấp nhận upload.

```
Signature = SHA1(timestamp + folder + api_secret)

Browser gửi: { file, timestamp, signature, api_key, folder }
Cloudinary:  SHA1(timestamp + folder + stored_api_secret) == signature?
  → YES: accept upload
  → NO:  reject (invalid signature)
```

**Signature có expiry:** `timestamp` phải trong vòng 1 giờ. Sau 1 giờ, signature expired → phải sign lại.

### 2.3 Implementation

```typescript
// UploadsService (Phase 5.3 — đã có sẵn)
async generateSignedUploadParams(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    this.configService.get('cloudinary.apiSecret') || '',
  );

  return {
    timestamp,
    signature,
    folder,
    cloudName: this.configService.get('cloudinary.cloudName'),
    apiKey: this.configService.get('cloudinary.apiKey'),
  };
}
```

`api_sign_request()` — Cloudinary SDK helper, tạo SHA1 signature từ params + secret. Frontend nhận signature → gửi kèm file lên `https://api.cloudinary.com/v1_1/{cloudName}/upload`.

---

## 3. UPLOAD FLOW — 3 BƯỚC

### 3.1 Bước 1: Sign & Create Pending

```typescript
// POST /api/uploads/sign
async signAndCreatePending(userId: string, dto: SignUploadDto) {
  // 1. Verify ownership (if lessonId provided)
  if (dto.lessonId) {
    await this.verifyLessonOwnership(userId, dto.lessonId);
  }

  // 2. Create Media record (status: UPLOADING)
  const media = await this.prisma.media.create({
    data: {
      type: dto.type as MediaType,
      status: 'UPLOADING',
      originalName: '',    // Chưa biết — updated ở step 3
      mimeType: '',
      size: 0,
      lessonId: dto.lessonId,
    },
  });

  // 3. Build folder + sign
  const folder = dto.folder || this.buildFolder(userId, dto.type, dto.lessonId);
  const params = await this.uploadsService.generateSignedUploadParams(folder);

  return { mediaId: media.id, ...params };
}
```

**Tại sao tạo Media record trước khi upload?**
- `mediaId` trả về cho frontend → frontend dùng để gọi `/complete` sau khi upload xong
- Nếu upload fail → Media record "treo" ở `UPLOADING` → cron job cleanup sau 24h (Phase 5.11)
- Track được upload progress: biết bao nhiêu file đang upload

**Folder strategy:**
```
courses/lessons/{lessonId}/  → Video/attachment cho lesson
users/{userId}/images/       → Avatar, post images
users/{userId}/files/        → General files
```

### 3.2 Bước 2: Frontend Upload (không qua backend)

```typescript
// Frontend code (React):
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('timestamp', String(signResult.timestamp));
formData.append('signature', signResult.signature);
formData.append('api_key', signResult.apiKey);
formData.append('folder', signResult.folder);

const response = await fetch(
  `https://api.cloudinary.com/v1_1/${signResult.cloudName}/upload`,
  { method: 'POST', body: formData }
);
const cloudinaryResult = await response.json();
// → { public_id, secure_url, duration, format, bytes }
```

### 3.3 Bước 3: Confirm Complete

```typescript
// POST /api/uploads/:mediaId/complete
async completeUpload(mediaId: string, userId: string, dto: CompleteUploadDto) {
  const media = await this.prisma.media.findUnique({ ... });

  // Guards
  if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
  if (media.status !== 'UPLOADING') throw new BadRequestException({ code: 'MEDIA_NOT_UPLOADING' });

  const { cloudinaryResult: cr } = dto;

  return this.prisma.$transaction(async (tx) => {
    // 1. Update media: UPLOADING → READY
    const updated = await tx.media.update({
      where: { id: mediaId },
      data: {
        status: 'READY',
        publicId: cr.publicId,
        urls: { original: cr.secureUrl },
        size: cr.bytes,
        mimeType: cr.format,
        originalName: cr.originalFilename || cr.publicId,
        duration: cr.duration,
      },
    });

    // 2. Counter cascade (if video lesson)
    if (media.lessonId && cr.duration) {
      await tx.lesson.update({ ... estimatedDuration: cr.duration });
      await this.recalculateCounters(tx, chapterId);
    }

    return updated;
  });
}
```

---

## 4. OWNERSHIP VERIFICATION — 4-Level Chain

### 4.1 Vấn đề

Instructor A không được upload video cho lesson của Instructor B. Cần verify ownership.

### 4.2 Chain: Lesson → Chapter → Section → Course → instructorId

```typescript
private async verifyLessonOwnership(userId: string, lessonId: string) {
  const lesson = await this.prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          section: {
            include: {
              course: { select: { instructorId: true } },
            },
          },
        },
      },
    },
  });
  if (!lesson) throw new NotFoundException({ code: 'LESSON_NOT_FOUND' });
  if (lesson.chapter.section.course.instructorId !== userId) {
    throw new ForbiddenException({ code: 'NOT_LESSON_OWNER' });
  }
}
```

**4-level nested include:**
```
Lesson
  └── chapter (Chapter)
        └── section (Section)
              └── course (Course)
                    └── instructorId  ← So sánh với userId
```

**Tại sao không lưu `instructorId` trên Lesson?** Denormalization → data consistency issues. Nếu instructor transfer course → phải update tất cả lessons. Traverse relation chain = single source of truth.

**Performance:** 1 query với 4-level include. PostgreSQL JOIN optimizer sẽ tối ưu thành 1 query với 3 JOINs. ~2-5ms cho indexed foreign keys.

---

## 5. COUNTER RECALCULATION — Cascade Pattern

### 5.1 Vấn đề

Khi video upload xong → biết `duration`. Cần cập nhật:
1. `lesson.estimatedDuration` = video duration
2. `chapter.totalDuration` = SUM(lessons.estimatedDuration)
3. `chapter.lessonsCount` = COUNT(lessons)
4. `course.totalDuration` = SUM(all lessons)
5. `course.totalLessons` = COUNT(all lessons)

### 5.2 Implementation — Bottom-Up Cascade

```typescript
private async recalculateCounters(tx: Prisma.TransactionClient, chapterId: string) {
  // Level 1: Chapter aggregate
  const chapterStats = await tx.lesson.aggregate({
    where: { chapterId },
    _sum: { estimatedDuration: true },
    _count: true,
  });
  const chapter = await tx.chapter.update({
    where: { id: chapterId },
    data: {
      totalDuration: chapterStats._sum.estimatedDuration || 0,
      lessonsCount: chapterStats._count,
    },
    select: { sectionId: true },
  });

  // Level 2: Course aggregate (via section)
  const section = await tx.section.findUnique({
    where: { id: chapter.sectionId },
    select: { courseId: true },
  });
  if (section) {
    const courseStats = await tx.lesson.aggregate({
      where: { chapter: { section: { courseId: section.courseId } } },
      _sum: { estimatedDuration: true },
      _count: true,
    });
    await tx.course.update({
      where: { id: section.courseId },
      data: {
        totalDuration: courseStats._sum.estimatedDuration || 0,
        totalLessons: courseStats._count,
      },
    });
  }
}
```

**Tại sao aggregate thay vì increment?**
```
❌ Increment: course.totalDuration += 120
   → Race condition: 2 videos upload cùng lúc → 1 increment lost
   → Drift over time (delete video → phải decrement → dễ quên)

✅ Aggregate: course.totalDuration = SUM(all lessons)
   → Always consistent — recalculate from source of truth
   → No race conditions — aggregate is atomic
   → Idempotent — chạy bao nhiêu lần cũng đúng
```

**Transaction:** Tất cả updates trong 1 `$transaction` → nếu course update fail, chapter update cũng rollback.

---

## 6. CIRCULAR DEPENDENCY — forwardRef

### 6.1 Vấn đề

```
UploadsModule
  ├── UploadsController uses MediaService
  └── imports MediaModule

MediaModule
  ├── MediaService uses UploadsService
  └── imports UploadsModule

→ Circular: UploadsModule ↔ MediaModule
```

### 6.2 NestJS forwardRef — Lý thuyết

```typescript
// Normal import: Module A loads → needs Module B → B loads → needs A → ERROR (A not ready)

// forwardRef: Module A loads → sees forwardRef(() => B) → defer → continue loading A
//             Module B loads → sees forwardRef(() => A) → defer → continue loading B
//             Both loaded → resolve deferred references → done
```

**Implementation:**
```typescript
// uploads.module.ts
@Module({
  imports: [forwardRef(() => MediaModule)],  // Defer
  ...
})
export class UploadsModule {}

// media.module.ts
@Module({
  imports: [forwardRef(() => UploadsModule)],  // Defer
  ...
})
export class MediaModule {}
```

`forwardRef(() => Module)` — returns a factory function instead of the class directly. NestJS DI container resolves it after all modules are instantiated.

### 6.3 Tại sao không merge thành 1 module?

- **SRP:** UploadsService = Cloudinary SDK wrapper. MediaService = business logic. Different concerns.
- **Reusability:** Các module khác có thể import `UploadsModule` để dùng `generateSignedUploadParams()` mà không cần MediaService.
- **Testing:** Mock UploadsService trong MediaService tests → test business logic isolated from Cloudinary.

---

## 7. MEDIA STATUS MACHINE

```
                    ┌──────────┐
    sign endpoint   │          │
  ─────────────────→│ UPLOADING│
                    │          │
                    └─────┬────┘
                          │
             complete endpoint
                          │
                    ┌─────▼────┐
                    │          │
                    │  READY   │ ← File accessible
                    │          │
                    └──────────┘

    24h cleanup cron (Phase 5.11)
                    ┌──────────┐
                    │          │
    UPLOADING ─────→│  FAILED  │ ← Stuck upload cleaned
                    │          │
                    └──────────┘

    PROCESSING status reserved for future:
    → Video transcoding (multi-resolution)
    → Image optimization
    → PDF text extraction
```

---

## 8. DELETE — Async Cloudinary Cleanup

```typescript
async deleteMedia(mediaId: string, userId: string) {
  // ...validation...

  // Delete from Cloudinary (async, don't block response)
  if (media.publicId) {
    this.uploadsService.deleteFile(media.publicId).catch(() => {});
  }

  return this.prisma.media.delete({ where: { id: mediaId } });
}
```

**`.catch(() => {})`** — fire-and-forget pattern:
- Cloudinary delete có thể mất 1-3 giây
- User không cần đợi Cloudinary response
- Nếu Cloudinary delete fail → file orphaned trên Cloudinary (không ảnh hưởng user)
- Orphaned files có thể cleanup bằng Cloudinary admin API sau

**Tại sao không dùng Bull queue?** Delete là operation nhẹ (~1 API call). Queue overhead (serialize → Redis → deserialize → process) lớn hơn lợi ích. Fire-and-forget đủ cho case này.

---

## 9. AVATAR & THUMBNAIL — Không cần endpoint riêng

**Đã có sẵn:**
- `PATCH /api/users/me { avatarUrl }` (Phase 5.5)
- `PATCH /api/instructor/courses/:id { thumbnailUrl }` (Phase 5.6)

**Frontend flow:**
```
1. POST /api/uploads/sign { type: 'IMAGE' }
   → { mediaId, signature, timestamp, apiKey, cloudName, folder }

2. Upload ảnh lên Cloudinary trực tiếp
   → { secure_url: 'https://res.cloudinary.com/...' }

3. PATCH /api/users/me { avatarUrl: secure_url }
   → User record updated

4. (Optional) POST /api/uploads/:mediaId/complete
   → Nếu muốn track media record. Hoặc skip — avatar URL đã lưu trên User.
```

**Không cần `POST /api/users/me/avatar` (multipart/form-data)** vì signed upload đã handle. Giữ API surface nhỏ gọn.

---

## 10. FILES CREATED / MODIFIED

| File | Action | Lines | Mục đích |
|------|--------|-------|----------|
| `modules/media/dto/sign-upload.dto.ts` | Created | 15 | lessonId?, type, folder? |
| `modules/media/dto/complete-upload.dto.ts` | Created | 28 | CloudinaryResultDto + CompleteUploadDto |
| `modules/media/media.service.ts` | Created | 170 | Sign, complete, delete, ownership, counters |
| `modules/media/media.module.ts` | Created | 10 | forwardRef → UploadsModule |
| `uploads/uploads.controller.ts` | Created | 45 | 3 endpoints: sign, complete, delete |
| `uploads/uploads.module.ts` | Modified | 12 | Added controller + forwardRef → MediaModule |
| `app.module.ts` | Modified | +3 | Import UploadsModule + MediaModule |
| `modules/media/media.service.spec.ts` | Created | 200 | 11 unit tests |

**Deleted:** 4 orphan folders (`analytics/`, `lessons/`, `payments/`, `reviews/`)

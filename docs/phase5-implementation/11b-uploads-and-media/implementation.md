# Phase 5.11b — UPLOADS & MEDIA MODULE

> Upload files lên Cloudinary (signed upload), quản lý Media records, avatar upload, course thumbnail.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md` — MODULE 13: UPLOADS
> Schema: Media, LessonAttachment
> Existing: `src/uploads/` (UploadsService + UploadsModule) — chỉ có service, chưa có controller

---

## Mục lục

- [Step 1: Architecture — Client-Side Signed Upload](#step-1-architecture)
- [Step 2: Module Structure](#step-2-module-structure)
- [Step 3: DTOs](#step-3-dtos)
- [Step 4: UploadsController — Sign endpoint](#step-4-uploadscontroller)
- [Step 5: MediaService — CRUD + Complete](#step-5-mediaservice)
- [Step 6: MediaController — Complete + Delete](#step-6-mediacontroller)
- [Step 7: Avatar Upload (Users)](#step-7-avatar-upload)
- [Step 8: Thumbnail Upload (Courses)](#step-8-thumbnail-upload)
- [Step 9: Register Modules](#step-9-register-modules)
- [Step 10: Verify](#step-10-verify)

---

## Step 1: Architecture — Client-Side Signed Upload

### Tại sao KHÔNG upload qua backend?

```
❌ Server-side upload:
  Browser ──(500MB video)──→ Backend ──(500MB)──→ Cloudinary
  → Backend phải buffer toàn bộ file trong RAM
  → Render.com free tier: 512MB RAM → crash
  → Upload time x2 (client→server + server→cloudinary)

✅ Client-side signed upload:
  Browser ──(sign request)──→ Backend ──(signature)──→ Browser
  Browser ──(500MB video)──────────────────────────────→ Cloudinary (direct)
  Browser ──(cloudinary result)──→ Backend ──(save media record)
  → Backend chỉ xử lý metadata (~1KB), không chạm file
  → Phù hợp free tier, upload nhanh hơn
```

### Flow hoàn chỉnh

```
Step 1: Frontend request signed params
  POST /api/uploads/sign { lessonId, type: "VIDEO" }
    → Backend creates Media record (status: UPLOADING)
    → Backend signs Cloudinary params
    → Returns { mediaId, signature, timestamp, apiKey, cloudName, folder }

Step 2: Frontend uploads directly to Cloudinary
  POST https://api.cloudinary.com/v1_1/{cloudName}/upload
    FormData: { file, signature, timestamp, api_key, folder }
    → Cloudinary processes file
    → Returns { public_id, secure_url, duration, bytes, format }

Step 3: Frontend confirms upload
  POST /api/uploads/{mediaId}/complete { cloudinaryResult }
    → Backend updates Media record (status: READY, urls, duration, size)
    → Backend updates Lesson.estimatedDuration
    → Backend recalculates Chapter + Course counters
```

### Đặc biệt: Avatar & Thumbnail

Avatar và thumbnail là **image nhỏ** (< 5MB) → có thể upload server-side qua `multipart/form-data`. Backend nhận file → upload lên Cloudinary → apply transform → trả URL. Đơn giản hơn signed upload cho image nhỏ.

Tuy nhiên, để giữ consistency và tránh buffer file trên server, **dùng signed upload cho tất cả**. Frontend gọi sign → upload trực tiếp → PATCH course/user với URL mới.

**Quyết định:** Avatar và Thumbnail dùng **PATCH endpoint với URL** (frontend upload trực tiếp lên Cloudinary, rồi gửi URL về backend). Không cần endpoint upload riêng:
- `PATCH /api/users/me { avatarUrl }` ← đã có từ Phase 5.5
- `PATCH /api/instructor/courses/:id { thumbnailUrl }` ← đã có từ Phase 5.6

→ Chỉ cần **sign endpoint** + **media complete endpoint** cho video/attachment.

---

## Step 2: Module Structure

```
src/uploads/                          # Existing — Cloudinary service
├── uploads.module.ts                 # Add UploadsController
├── uploads.service.ts                # Existing — sign, delete, getVideoInfo
└── uploads.controller.ts             # NEW — POST /api/uploads/sign

src/modules/media/                    # NEW — Media records management
├── media.module.ts
├── media.service.ts                  # CRUD + complete + counter recalculation
├── media.controller.ts               # POST /complete, DELETE
└── dto/
    ├── sign-upload.dto.ts
    └── complete-upload.dto.ts
```

**Tại sao tách Uploads vs Media?**
- `UploadsService` — Cloudinary concerns (sign, delete, getInfo). Infrastructure layer.
- `MediaService` — Business logic (create record, verify ownership, update counters). Domain layer.

---

## Step 3: DTOs

### `sign-upload.dto.ts`

```typescript
export class SignUploadDto {
  @IsOptional() @IsString()
  lessonId?: string;                   // Optional — for lesson video/attachment

  @IsIn(['VIDEO', 'IMAGE', 'ATTACHMENT'])
  type!: string;

  @IsOptional() @IsString()
  folder?: string;                     // Custom folder override
}
```

### `complete-upload.dto.ts`

```typescript
export class CloudinaryResultDto {
  @IsString()
  publicId!: string;                   // Cloudinary public_id

  @IsString()
  secureUrl!: string;                  // https://res.cloudinary.com/...

  @IsOptional() @IsNumber()
  duration?: number;                   // Video duration in seconds

  @IsString()
  format!: string;                     // mp4, jpg, pdf

  @IsNumber()
  bytes!: number;                      // File size in bytes

  @IsOptional() @IsString()
  originalFilename?: string;           // Original file name
}

export class CompleteUploadDto {
  @ValidateNested()
  @Type(() => CloudinaryResultDto)
  cloudinaryResult!: CloudinaryResultDto;
}
```

---

## Step 4: UploadsController — Sign endpoint

```typescript
@Controller('uploads')
@ApiBearerAuth()
export class UploadsController {
  constructor(
    @Inject(UploadsService) private readonly uploadsService: UploadsService,
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

  @Post('sign')
  @ApiOperation({ summary: 'Generate Cloudinary signed upload params' })
  async sign(@CurrentUser() user: JwtPayload, @Body() dto: SignUploadDto) {
    // 1. Determine folder
    const folder = dto.folder || this.buildFolder(user.sub, dto.type, dto.lessonId);

    // 2. Create Media record (status: UPLOADING)
    const media = await this.mediaService.createPending(user.sub, dto);

    // 3. Generate signed params
    const params = await this.uploadsService.generateSignedUploadParams(folder);

    return { mediaId: media.id, ...params };
  }

  private buildFolder(userId: string, type: string, lessonId?: string): string {
    if (lessonId) return `courses/lessons/${lessonId}`;
    if (type === 'IMAGE') return `users/${userId}/images`;
    return `users/${userId}/files`;
  }
}
```

---

## Step 5: MediaService — CRUD + Complete

```typescript
@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UploadsService) private readonly uploadsService: UploadsService,
  ) {}

  // Create pending media record
  async createPending(userId: string, dto: SignUploadDto) {
    // If lessonId provided, verify ownership
    if (dto.lessonId) {
      await this.verifyLessonOwnership(userId, dto.lessonId);
    }

    return this.prisma.media.create({
      data: {
        type: dto.type as MediaType,
        status: 'UPLOADING',
        originalName: '',    // Updated on complete
        mimeType: '',        // Updated on complete
        size: 0,             // Updated on complete
        lessonId: dto.lessonId,
      },
    });
  }

  // Confirm upload complete — update media + lesson/chapter/course counters
  async completeUpload(mediaId: string, userId: string, dto: CompleteUploadDto) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      include: { lesson: { include: { chapter: true } } },
    });
    if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });
    if (media.status !== 'UPLOADING') {
      throw new BadRequestException({ code: 'MEDIA_NOT_UPLOADING' });
    }

    // Verify ownership if linked to lesson
    if (media.lessonId) {
      await this.verifyLessonOwnership(userId, media.lessonId);
    }

    const { cloudinaryResult: cr } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update media record
      const updated = await tx.media.update({
        where: { id: mediaId },
        data: {
          status: 'READY',
          publicId: cr.publicId,
          urls: { original: cr.secureUrl } as Prisma.InputJsonValue,
          size: cr.bytes,
          mimeType: cr.format,
          originalName: cr.originalFilename || cr.publicId,
          duration: cr.duration,
        },
      });

      // 2. If video lesson — update lesson duration + recalculate counters
      if (media.lessonId && cr.duration) {
        await tx.lesson.update({
          where: { id: media.lessonId },
          data: { estimatedDuration: cr.duration },
        });

        // Recalculate chapter totalDuration
        if (media.lesson?.chapterId) {
          const chapterStats = await tx.lesson.aggregate({
            where: { chapterId: media.lesson.chapterId },
            _sum: { estimatedDuration: true },
            _count: true,
          });
          await tx.chapter.update({
            where: { id: media.lesson.chapterId },
            data: {
              totalDuration: chapterStats._sum.estimatedDuration || 0,
              lessonCount: chapterStats._count,
            },
          });

          // Recalculate course totalDuration
          const chapter = media.lesson.chapter;
          if (chapter) {
            const courseStats = await tx.lesson.aggregate({
              where: { chapter: { section: { courseId: chapter.sectionId } } },
              _sum: { estimatedDuration: true },
              _count: true,
            });
            // Note: courseId lookup via chapter → section → course
            // Simplified: find course from chapter's section
            const section = await tx.section.findUnique({
              where: { id: chapter.sectionId },
              select: { courseId: true },
            });
            if (section) {
              await tx.course.update({
                where: { id: section.courseId },
                data: {
                  totalDuration: courseStats._sum.estimatedDuration || 0,
                  totalLessons: courseStats._count,
                },
              });
            }
          }
        }
      }

      return updated;
    });
  }

  // Delete media + Cloudinary file
  async deleteMedia(mediaId: string, userId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND' });

    // Verify ownership if linked to lesson
    if (media.lessonId) {
      await this.verifyLessonOwnership(userId, media.lessonId);
    }

    // Delete from Cloudinary (async, don't block)
    if (media.publicId) {
      this.uploadsService.deleteFile(media.publicId).catch(() => {});
    }

    return this.prisma.media.delete({ where: { id: mediaId } });
  }

  // Get media for a lesson
  async getByLessonId(lessonId: string) {
    return this.prisma.media.findMany({
      where: { lessonId, status: 'READY' },
      orderBy: { createdAt: 'asc' },
    });
  }

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
}
```

---

## Step 6: MediaController

```typescript
@Controller('uploads')
@ApiBearerAuth()
export class MediaController {
  constructor(@Inject(MediaService) private readonly mediaService: MediaService) {}

  @Post(':mediaId/complete')
  @ApiOperation({ summary: 'Confirm upload complete' })
  async complete(
    @Param('mediaId', ParseCuidPipe) mediaId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.mediaService.completeUpload(mediaId, user.sub, dto);
  }

  @Delete(':mediaId')
  @ApiOperation({ summary: 'Delete media file' })
  async delete(
    @Param('mediaId', ParseCuidPipe) mediaId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.deleteMedia(mediaId, user.sub);
  }
}
```

**Note:** MediaController cũng dùng `@Controller('uploads')` vì routes nằm dưới `/api/uploads/:mediaId/...`. Hoặc có thể merge vào UploadsController.

**Quyết định:** Gộp tất cả vào 1 controller `UploadsController` để tránh route conflict:

```typescript
@Controller('uploads')
export class UploadsController {
  @Post('sign')        → sign upload
  @Post(':mediaId/complete')  → confirm upload
  @Delete(':mediaId')  → delete media
}
```

---

## Step 7: Avatar Upload

**Đã có sẵn:** `PATCH /api/users/me { avatarUrl }` (Phase 5.5). Frontend:
1. Gọi `POST /api/uploads/sign { type: 'IMAGE' }`
2. Upload ảnh trực tiếp lên Cloudinary
3. Gọi `PATCH /api/users/me { avatarUrl: cloudinary_url }`

Không cần endpoint mới. Chỉ cần signed upload param.

---

## Step 8: Thumbnail Upload

**Đã có sẵn:** `PATCH /api/instructor/courses/:id { thumbnailUrl }` (Phase 5.6). Same flow as avatar.

---

## Step 9: Register Modules

```typescript
// app.module.ts
import { UploadsModule } from './uploads/uploads.module';
import { MediaModule } from './modules/media/media.module';

// In imports:
UploadsModule,
MediaModule,
```

`UploadsModule` cần import `MediaModule` (controller sử dụng MediaService):
```typescript
// uploads.module.ts — updated
@Module({
  imports: [MediaModule],
  providers: [UploadsService],
  controllers: [UploadsController],
  exports: [UploadsService],
})
```

---

## Step 10: Verify

### Endpoints

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | POST | `/api/uploads/sign` | Generate signed upload params + create pending Media |
| 2 | POST | `/api/uploads/:mediaId/complete` | Confirm upload, update record + counters |
| 3 | DELETE | `/api/uploads/:mediaId` | Delete media + Cloudinary file |

### Checklist

- [ ] `POST /api/uploads/sign` returns signature + mediaId
- [ ] Media record created with status UPLOADING
- [ ] Ownership verified via lesson → chapter → section → course.instructorId chain
- [ ] `POST /api/uploads/:mediaId/complete` updates status → READY
- [ ] Video duration propagated: lesson.estimatedDuration → chapter.totalDuration → course.totalDuration
- [ ] Counter recalculation in $transaction
- [ ] `DELETE /api/uploads/:mediaId` deletes record + Cloudinary file (async)
- [ ] Avatar: use `PATCH /api/users/me { avatarUrl }` (existing)
- [ ] Thumbnail: use `PATCH /api/instructor/courses/:id { thumbnailUrl }` (existing)
- [ ] UploadsModule registered in AppModule
- [ ] MediaModule registered in AppModule
- [ ] Build: 0 errors
- [ ] Lint: 0 errors
- [ ] Tests: all passing

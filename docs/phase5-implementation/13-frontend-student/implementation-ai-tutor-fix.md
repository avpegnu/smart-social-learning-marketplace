# Fix AI Tutor — Course Content Indexing & System Prompt

> **Vấn đề:** `indexCourseContent()` không bao giờ được gọi → bảng `course_chunks` trống → AI Tutor không có context khóa học → trả lời chung chung.
>
> **Mục tiêu:** AI Tutor trả lời chính xác dựa trên nội dung khóa học, từ chối câu hỏi không liên quan.

---

## 1. Mở rộng `indexCourseContent()` — Lấy đầy đủ nội dung

**File:** `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`

**Hiện tại:** Chỉ index TEXT lessons (`title + textContent`).

**Cần sửa:** Index đầy đủ 4 nguồn:

### 1.1 Course metadata
```
[Course] {title}
{shortDescription}
{description} (strip HTML tags)

Learning outcomes:
- outcome 1
- outcome 2

Prerequisites:
- prereq 1
```

### 1.2 Section & Chapter structure
```
[Section] {section.title}
[Chapter] {chapter.title}: {chapter.description}
```

### 1.3 TEXT lessons (đã có)
```
[Lesson] {lesson.title}
{lesson.textContent}
```

### 1.4 QUIZ lessons
```
[Quiz] {lesson.title}
Q: {question.question}
Options: A) option1, B) option2, C) option3, D) option4
Answer: {correct option}
Explanation: {question.explanation}
```

**Thay đổi code:**
- Xóa query cũ chỉ lấy TEXT lessons
- Thay bằng 1 query lấy course + sections + chapters + lessons (tất cả types) + quizzes
- Format từng nguồn thành text → chunk → embed → insert
- Lesson type VIDEO: chỉ index title (không có transcript)
- `lessonId` nullable cho chunks từ course metadata / section / chapter

### 1.5 Strip HTML helper
```typescript
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
```

Dùng cho `description` vì Tiptap lưu HTML.

---

## 2. Trigger indexing khi course được PUBLISH

**File:** `apps/api/src/modules/admin/courses/admin-courses.service.ts`

**Vị trí:** `reviewCourse()` — line 140-162, sau khi set `status: 'PUBLISHED'`

**Thay đổi:**
1. Import `AiTutorModule` vào `AdminModule`
2. Inject `EmbeddingsService` vào `AdminCoursesService`
3. Sau khi publish thành công, gọi `indexCourseContent(courseId)` **ngoài transaction** (fire-and-forget, không block review response)

```typescript
// Sau transaction thành công
if (dto.approved) {
  // Fire-and-forget — không block response
  this.embeddingsService.indexCourseContent(courseId).catch((err) => {
    this.logger.warn(`Failed to index course ${courseId}: ${err.message}`);
  });
}
```

**Lý do fire-and-forget:** Indexing có thể mất 10-30 giây tùy số lượng lessons. Admin không cần chờ.

---

## 3. Thêm cron job re-index

**File:** `apps/api/src/modules/jobs/cron/cron.service.ts`

**Thêm cron #10:** Re-index tất cả published courses chưa có chunks (daily 5 AM)

```typescript
// 10. Index published courses for AI Tutor (daily 5 AM)
@Cron('0 5 * * *')
async indexCoursesForAiTutor() {
  // Find published courses with NO chunks
  const unindexed = await this.prisma.course.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      courseChunks: { none: {} },
    },
    select: { id: true },
  });

  for (const course of unindexed) {
    try {
      await this.embeddingsService.indexCourseContent(course.id);
      this.logger.log(`Indexed course ${course.id} for AI Tutor`);
    } catch (err) {
      this.logger.warn(`Failed to index course ${course.id}: ${err.message}`);
    }
  }

  if (unindexed.length > 0) {
    this.logger.log(`AI Tutor indexing: ${unindexed.length} courses processed`);
  }
}
```

**Lý do:** Backup cho trường hợp publish trigger bị miss (network error, embeddings model chưa sẵn sàng).

**Dependencies:** Import `AiTutorModule` vào `JobsModule`, inject `EmbeddingsService` vào `CronService`.

---

## 4. Cải thiện System Prompt

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.service.ts`

**Hiện tại (quá chung chung):**
```
You are an AI tutor for an online course. Answer based on the course content provided below.
If the answer is not in the course content, say so honestly.
```

**Cần đổi thành (chi tiết, có boundaries):**
```
You are an AI tutor assistant for an online learning platform. Your role is to help students understand the course material.

RULES:
1. ONLY answer questions related to the course content provided below
2. If a question is NOT related to the course content, politely decline and suggest the student ask about course topics instead
3. Use examples and analogies to explain complex concepts
4. If the course content doesn't cover a topic, say: "This topic is not covered in the current course material"
5. Be encouraging and supportive — motivate students to keep learning
6. Format your response with markdown for readability (headings, bullet points, code blocks)
7. Always respond in the SAME LANGUAGE the student uses

COURSE CONTENT:
---
{context}
---

Remember: You are a tutor for THIS specific course only. Do not provide information outside the course scope.
```

---

## 5. Thêm admin endpoint để manual trigger

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.controller.ts`

**Thêm endpoint:**
```typescript
@Post('index/:courseId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.INSTRUCTOR)
@ApiOperation({ summary: 'Index course content for AI Tutor' })
async indexCourse(
  @Param('courseId') courseId: string,
  @CurrentUser() user: JwtPayload,
) {
  // Verify ownership (instructor) or admin
  await this.embeddingsService.indexCourseContent(courseId);
  return { message: 'Course indexed successfully' };
}
```

**Lý do:** Admin/Instructor có thể trigger re-index sau khi update nội dung lessons mà không cần chờ cron.

---

## 6. Re-index khi lesson content thay đổi

**File:** `apps/api/src/modules/courses/lessons/lessons.service.ts`

**KHÔNG tự động re-index** khi update lesson — vì:
- Instructor có thể update nhiều lessons liên tục
- Mỗi lần re-index tốn 10-30 giây
- Gây lag cho instructor

**Thay vào đó:** Dùng endpoint manual ở mục 5. Instructor sửa xong tất cả lessons → ấn "Re-index for AI" 1 lần.

Hoặc cron job hàng đêm sẽ catch up.

---

## 7. File changes summary

| File | Thay đổi |
|------|----------|
| `embeddings.service.ts` | Mở rộng `indexCourseContent()` — index course metadata, sections, chapters, quizzes |
| `ai-tutor.service.ts` | Cải thiện system prompt |
| `ai-tutor.controller.ts` | Thêm `POST /ai/tutor/index/:courseId` endpoint |
| `admin-courses.service.ts` | Gọi `indexCourseContent()` khi publish (fire-and-forget) |
| `admin-courses.module.ts` | Import `AiTutorModule` |
| `cron.service.ts` | Thêm cron #10: index unindexed courses daily 5 AM |
| `jobs.module.ts` | Import `AiTutorModule` |

**Không cần migration** — bảng `course_chunks` và cột `embedding` đã có sẵn.

---

## 8. Testing

### 8.1 Unit tests
- `embeddings.service.spec.ts`: Test `indexCourseContent()` với course có đủ loại lessons
- `cron.service.spec.ts`: Test cron #10 gọi đúng `indexCourseContent()`

### 8.2 Manual test flow
1. Tạo course với TEXT lessons + QUIZ lessons
2. Admin approve course → verify `course_chunks` table có data
3. Vào AI Tutor → chọn course → hỏi câu liên quan → AI trả lời dựa trên nội dung
4. Hỏi câu không liên quan → AI từ chối lịch sự
5. Trigger manual re-index endpoint → verify chunks updated

### 8.3 Edge cases
- Course không có lessons → index rỗng, AI nói "chưa có nội dung"
- Course chỉ có VIDEO lessons → index title only
- Embeddings model chưa load → catch error, log warning
- Course đã index → re-index xóa cũ + insert mới

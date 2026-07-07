# Giải thích chi tiết — Fix AI Tutor: Course Content Indexing & RAG Pipeline

## 1. Tổng quan vấn đề

### 1.1 Kiến trúc RAG (Retrieval-Augmented Generation)

RAG là một kỹ thuật kết hợp giữa **truy xuất thông tin** (Retrieval) và **sinh văn bản** (Generation) để tạo ra câu trả lời chính xác hơn. Thay vì để AI trả lời hoàn toàn từ "trí nhớ" (training data), RAG bổ sung thêm **ngữ cảnh thực tế** từ cơ sở dữ liệu trước khi AI sinh câu trả lời.

Luồng hoạt động RAG trong AI Tutor:

```
Sinh viên đặt câu hỏi
    |
    v
[1. Embedding] Chuyển câu hỏi thành vector 384 chiều
    |
    v
[2. Retrieval] Tìm 5 đoạn nội dung khóa học tương tự nhất (cosine similarity)
    |
    v
[3. Augmented Prompt] Ghép nội dung tìm được vào system prompt
    |
    v
[4. Generation] Groq/Llama 3.3 sinh câu trả lời dựa trên context
    |
    v
Trả lời được trả về cho sinh viên (streaming SSE)
```

### 1.2 Vấn đề: indexCourseContent() không bao giờ được gọi

Trước khi fix, hệ thống có hàm `indexCourseContent()` trong `EmbeddingsService` nhưng **không có bất kỳ nơi nào gọi hàm này**:

- Không có endpoint API để trigger thủ công
- Không có logic tự động gọi khi admin publish khóa học
- Không có cron job để index các khóa học chưa được index

**Kết quả:** Bảng `course_chunks` trong database **luôn rỗng**. Khi sinh viên hỏi AI Tutor, bước Retrieval trả về `"Course content is not yet indexed for AI search."` — AI chỉ có thể trả lời từ training data chung, không biết gì về nội dung khóa học cụ thể.

### 1.3 Vấn đề phụ: Frontend mất tin nhắn khi streaming

Ngoài vấn đề backend, frontend còn có bug: khi AI đang streaming trả lời, **tin nhắn của người dùng biến mất**. Nguyên nhân là `useEffect` đồng bộ session messages ghi đè `localMessages` trong lúc streaming.

---

## 2. RAG Pipeline — Lý thuyết

### 2.1 Embedding là gì?

**Embedding** là cách chuyển đổi văn bản (text) thành **vector số** (mảng các số thực) sao cho các văn bản có ý nghĩa tương tự sẽ có vector "gần nhau" trong không gian nhiều chiều.

**Model: MiniLM-L6-v2 (384 dimensions)**

```
"Lập trình React" → [0.023, -0.114, 0.891, ..., 0.045]  (384 số)
"Học React.js"    → [0.021, -0.109, 0.887, ..., 0.042]  (384 số, gần giống!)
"Nấu ăn Việt Nam" → [0.512, 0.334, -0.221, ..., 0.761]  (384 số, khác xa)
```

Model này chạy **local** (không cần gọi API bên ngoài), được load qua thư viện `@huggingface/transformers`:

```typescript
const { pipeline } = await import('@huggingface/transformers');
this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```

**Cosine Similarity** đo mức độ "giống nhau" giữa 2 vector:
- `1.0` = hoàn toàn giống nhau
- `0.0` = không liên quan
- `-1.0` = hoàn toàn trái ngược

### 2.2 Chunking Strategy

**Tại sao phải chia nhỏ văn bản (chunking)?**

Model embedding có giới hạn về độ dài input. Ngoài ra, mỗi chunk nhỏ mang một ý nghĩa cụ thể, giúp retrieval chính xác hơn. Nếu nhồi cả nội dung khóa học vào 1 embedding duy nhất, thông tin bị "pha loãng" và tìm kiếm kém chính xác.

**Thông số chunking:**
- **Chunk size:** 500 ký tự
- **Overlap:** 50 ký tự (giữa các chunk kề nhau)

```
Văn bản gốc: "AAAAABBBBBCCCCC" (1400 ký tự)

Chunk 1: ký tự 0 → 500
Chunk 2: ký tự 450 → 950    ← 50 ký tự đầu trùng với cuối chunk 1
Chunk 3: ký tự 900 → 1400   ← 50 ký tự đầu trùng với cuối chunk 2
```

**Tại sao cần overlap?** Để tránh trường hợp một câu bị cắt đôi giữa 2 chunk, làm mất ngữ cảnh. Overlap 50 ký tự đảm bảo các câu ở ranh giới vẫn được giữ nguyên ít nhất ở 1 chunk.

**Trade-off:**
| Chunk nhỏ (200 ký tự) | Chunk lớn (1000 ký tự) |
|---|---|
| Tìm kiếm chính xác hơn | Nhiều ngữ cảnh hơn mỗi chunk |
| Nhiều chunk hơn → chậm hơn | Ít chunk hơn → nhanh hơn |
| Có thể mất ngữ cảnh rộng | Có thể chứa thông tin không liên quan |

Chọn **500 ký tự** là mức cân bằng hợp lý cho nội dung khóa học.

### 2.3 pgvector

**pgvector** là extension của PostgreSQL cho phép lưu trữ và truy vấn vector trực tiếp trong database.

**Cách lưu:** Cột `embedding` có kiểu `vector(384)` — lưu mảng 384 số thực.

**Toán tử cosine distance:** `<=>` — tính khoảng cách cosine giữa 2 vector.

```sql
-- Tìm 5 chunk gần nhất với câu hỏi của sinh viên
SELECT content, 1 - (embedding <=> $1::vector) AS similarity
FROM course_chunks
WHERE course_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5
```

- `embedding <=> $1::vector` = cosine distance (0 là giống, 2 là khác)
- `1 - distance` = cosine similarity (1 là giống, -1 là khác)
- `ORDER BY ... ASC` = lấy các chunk có distance nhỏ nhất (giống nhất)

---

## 3. Thay đổi chi tiết

### 3.1 Mở rộng indexCourseContent() (embeddings.service.ts)

**File:** `apps/api/src/modules/ai-tutor/embeddings/embeddings.service.ts`

**Trước:** Chỉ index các lesson loại TEXT — bỏ qua metadata khóa học, cấu trúc section/chapter, quiz, video.

**Sau:** Index **4 nguồn dữ liệu** từ khóa học:

#### Nguồn 1: Course Metadata

```typescript
// 1. Index course metadata
const metaParts: string[] = [`[Course] ${course.title}`];
if (course.shortDescription) metaParts.push(course.shortDescription);
if (course.description) metaParts.push(stripHtml(course.description));

const outcomes = course.learningOutcomes as string[] | null;
if (outcomes?.length) {
  metaParts.push('Learning outcomes:\n' + outcomes.map((o) => `- ${o}`).join('\n'));
}

const prereqs = course.prerequisites as string[] | null;
if (prereqs?.length) {
  metaParts.push('Prerequisites:\n' + prereqs.map((p) => `- ${p}`).join('\n'));
}
```

Bao gồm: tiêu đề, mô tả ngắn, mô tả chi tiết (strip HTML), kết quả học tập, điều kiện tiên quyết.

#### Nguồn 2: TEXT Lessons

```typescript
if (lesson.type === 'TEXT') {
  const text = `${chapterHeader}\n[Lesson] ${lesson.title}\n${lesson.textContent ?? ''}`;
  chunksInserted += await this.insertChunks(courseId, lesson.id, text);
}
```

Mỗi bài học TEXT được index kèm ngữ cảnh của section/chapter chứa nó.

#### Nguồn 3: QUIZ Lessons

```typescript
if (lesson.type === 'QUIZ' && lesson.quiz) {
  const quizParts = [`${chapterHeader}\n[Quiz] ${lesson.title}`];
  for (const q of lesson.quiz.questions) {
    const options = q.options.map((o, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, D
      return `${letter}) ${o.text}${o.isCorrect ? ' ✓' : ''}`;
    });
    quizParts.push(
      `Q: ${q.question}\n${options.join('\n')}${q.explanation ? '\nExplanation: ' + q.explanation : ''}`,
    );
  }
  chunksInserted += await this.insertChunks(courseId, lesson.id, quizParts.join('\n\n'));
}
```

Index câu hỏi, các lựa chọn (đánh dấu đáp án đúng bằng ✓), và giải thích. Điều này cho phép AI Tutor trả lời các câu hỏi liên quan đến quiz.

#### Nguồn 4: VIDEO Lessons (chỉ tiêu đề)

```typescript
if (lesson.type === 'VIDEO') {
  const text = `${chapterHeader}\n[Video Lesson] ${lesson.title}`;
  if (text.length >= 30) {
    chunksInserted += await this.insertChunks(courseId, lesson.id, text);
  }
}
```

Do chưa có transcript, chỉ index tiêu đề video để AI biết khóa học có những video nào.

#### Helper: stripHtml

```typescript
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')      // Xóa tất cả HTML tags
    .replace(/&nbsp;/g, ' ')      // Chuyển HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')         // Gộp khoảng trắng thừa
    .trim();
}
```

Cần thiết vì mô tả khóa học được soạn bằng Tiptap rich text editor, lưu dưới dạng HTML.

#### Helper: insertChunks

```typescript
private async insertChunks(
  courseId: string,
  lessonId: string | null,
  text: string,
): Promise<number> {
  if (text.trim().length < 30) return 0;  // Bỏ qua text quá ngắn

  const chunks = this.chunkText(text, 500, 50);
  let count = 0;

  for (const chunk of chunks) {
    const embedding = await this.generateEmbedding(chunk);
    const embeddingStr = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      INSERT INTO course_chunks (id, course_id, lesson_id, content, embedding, created_at)
      VALUES (gen_random_uuid(), ${courseId}, ${lessonId}, ${chunk}, ${embeddingStr}::vector, now())
    `;
    count++;
  }

  return count;
}
```

Điểm đáng chú ý:
- Sử dụng `$executeRaw` với tagged template literal để tránh SQL injection (Prisma tự động parameterize)
- `${embeddingStr}::vector` — cast chuỗi JSON array thành kiểu `vector` của pgvector
- `gen_random_uuid()` — PostgreSQL tự tạo UUID cho mỗi chunk
- `lessonId` có thể là `null` (cho metadata khóa học không thuộc lesson cụ thể nào)

#### Prisma Query Structure

```typescript
const course = await this.prisma.course.findUnique({
  where: { id: courseId },
  select: {
    title: true,
    shortDescription: true,
    description: true,
    learningOutcomes: true,
    prerequisites: true,
    sections: {
      orderBy: { order: 'asc' },
      select: {
        title: true,
        chapters: {
          orderBy: { order: 'asc' },
          select: {
            title: true,
            description: true,
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                type: true,
                textContent: true,
                quiz: {
                  select: {
                    questions: {
                      orderBy: { order: 'asc' },
                      select: {
                        question: true,
                        explanation: true,
                        options: {
                          select: { text: true, isCorrect: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
```

Cấu trúc nested `select` giúp Prisma tạo một query JOIN hiệu quả, lấy tất cả dữ liệu cần thiết trong **một lần truy vấn** thay vì N+1 queries.

### 3.2 Cải thiện System Prompt (ai-tutor.service.ts)

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.service.ts`

**Trước:** System prompt đơn giản, không có ranh giới rõ ràng:

```
You are a helpful AI tutor. Answer based on the course content below.
```

**Sau:** System prompt chi tiết với 7 quy tắc hành vi:

```typescript
const systemPrompt = `You are an AI tutor assistant for an online learning platform. Your role is to help students understand the course material.

RULES:
1. ONLY answer questions related to the course content provided below
2. If a question is NOT related to the course content, politely decline and suggest the student ask about course topics instead
3. Use examples and analogies to explain complex concepts
4. If the course content does not cover a topic, say: "This topic is not covered in the current course material"
5. Be encouraging and supportive — motivate students to keep learning
6. Format your response with markdown for readability (headings, bullet points, code blocks when appropriate)
7. Always respond in the SAME LANGUAGE the student uses

COURSE CONTENT:
---
${context}
---

Remember: You are a tutor for THIS specific course only. Do not provide information outside the course scope.`;
```

**Tại sao ranh giới quan trọng?**

- **Quy tắc 1-2:** Ngăn AI trả lời các câu hỏi không liên quan (ví dụ: "Làm thế nào để hack website?" trong khóa học React)
- **Quy tắc 3:** Khiến câu trả lời dễ hiểu hơn cho sinh viên
- **Quy tắc 4:** Thành thật khi không biết — tránh "hallucination" (bịa ra thông tin)
- **Quy tắc 5:** Tạo động lực học tập
- **Quy tắc 6:** Markdown giúp hiển thị đẹp trên giao diện
- **Quy tắc 7:** Tự động phát hiện ngôn ngữ (tiếng Việt/tiếng Anh) và trả lời cùng ngôn ngữ

**Cấu trúc messages gửi đến Groq:**

```typescript
return [
  { role: 'system', content: systemPrompt },        // System prompt + course context
  ...history.map((m) => ({                            // 10 tin nhắn gần nhất
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  })),
  { role: 'user', content: question },               // Câu hỏi hiện tại
];
```

### 3.3 Admin Index Endpoint (ai-tutor.controller.ts)

**File:** `apps/api/src/modules/ai-tutor/ai-tutor.controller.ts`

Thêm endpoint mới cho phép Admin hoặc Instructor **thủ công trigger** việc index nội dung khóa học:

```typescript
@Post('index/:courseId')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.INSTRUCTOR)
@ApiOperation({ summary: 'Index course content for AI Tutor (admin/instructor)' })
async indexCourse(@Param('courseId', ParseCuidPipe) courseId: string) {
  await this.embeddingsService.indexCourseContent(courseId);
  return { message: 'Course indexed successfully' };
}
```

**Use case:**
- Admin muốn re-index khóa học sau khi instructor cập nhật nội dung
- Debug: kiểm tra xem indexing có hoạt động đúng không
- Khóa học cũ (published trước khi có fix này) cần được index thủ công

**Bảo mật:**
- `@UseGuards(RolesGuard)` + `@Roles(Role.ADMIN, Role.INSTRUCTOR)` — chỉ ADMIN hoặc INSTRUCTOR mới gọi được
- `ParseCuidPipe` — validate courseId đúng định dạng CUID

### 3.4 SSE Timeout Fix (ai-tutor.controller.ts)

**Vấn đề:** NestJS/Express có default request timeout là 2 phút (120 giây). Với các câu hỏi phức tạp, streaming có thể kéo dài hơn thời gian này, làm kết nối bị đóng giữa chừng.

**Fix:**

```typescript
@Post('ask-stream')
async askStream(
  @CurrentUser() user: JwtPayload,
  @Body() dto: AskQuestionDto,
  @Req() req: { setTimeout: (ms: number) => void },
  @Res() res: Response,
) {
  // Disable request timeout for long-running SSE stream
  req.setTimeout(0);
  // ...
}
```

`req.setTimeout(0)` tắt hoàn toàn timeout cho request này. Chỉ ảnh hưởng endpoint này, không ảnh hưởng các endpoint khác.

**Tại sao chỉ cần ở đây?** Các endpoint khác (REST thông thường) nên giữ timeout để tránh request treo mãi. SSE là trường hợp đặc biệt: kết nối cần duy trì lâu để stream dữ liệu.

### 3.5 Auto-index khi Publish (admin-courses.service.ts)

**File:** `apps/api/src/modules/admin/courses/admin-courses.service.ts`

Khi admin approve khóa học (PENDING_REVIEW → PUBLISHED), tự động index nội dung cho AI Tutor:

```typescript
async reviewCourse(courseId: string, _adminId: string, dto: ReviewCourseDto) {
  // ... validation ...

  if (dto.approved) {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id: courseId },
        data: {
          status: 'PUBLISHED',
          publishedAt: course.publishedAt ?? new Date(),
        },
      });

      // Auto-create private course group
      await tx.group.create({ /* ... */ });

      return updated;
    });

    // Index course content for AI Tutor (fire-and-forget)
    this.embeddingsService.indexCourseContent(courseId).catch((err: Error) => {
      this.logger.warn(`Failed to index course ${courseId} for AI Tutor: ${err.message}`);
    });

    return result;
  }
  // ...
}
```

**Điểm quan trọng:**

1. **Fire-and-forget pattern:** Không dùng `await` — response trả về ngay cho admin, việc index chạy ngầm (xem phần 5.1)
2. **Ngoài transaction:** `indexCourseContent` được gọi **sau** khi transaction thành công. Nếu đặt trong transaction, indexing chậm sẽ làm transaction giữ lock lâu, ảnh hưởng performance
3. **Error handling:** `.catch()` bắt lỗi nhưng không throw — nếu indexing thất bại, việc publish vẫn thành công. Cron job sẽ retry sau

### 3.6 Cron Job #10 (cron.service.ts)

**File:** `apps/api/src/modules/jobs/cron/cron.service.ts`

Thêm cron job chạy hàng ngày lúc 5 giờ sáng để index các khóa học published chưa được index:

```typescript
// 10. Index published courses for AI Tutor (daily 5 AM)
@Cron('0 5 * * *')
async indexCoursesForAiTutor() {
  if (!this.embeddingsService.isReady()) return;

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
      this.logger.log(`AI Tutor: indexed course ${course.id}`);
    } catch (err) {
      this.logger.warn(
        `AI Tutor: failed to index course ${course.id}: ${(err as Error).message}`,
      );
    }
  }

  if (unindexed.length > 0) {
    this.logger.log(`AI Tutor indexing: ${unindexed.length} courses processed`);
  }
}
```

**Logic chi tiết:**

1. **Kiểm tra embeddings model:** `isReady()` trả về `false` nếu model chưa load xong (ví dụ: server vừa restart). Trong trường hợp này, skip hoàn toàn — không query database vô ích
2. **Tìm khóa học chưa index:** `courseChunks: { none: {} }` — Prisma relation filter, tìm các course **không có bất kỳ chunk nào** trong bảng `course_chunks`
3. **Xử lý từng khóa học:** Dùng `for...of` (tuần tự) thay vì `Promise.all` để tránh tạo quá nhiều embedding cùng lúc, gây quá tải CPU
4. **Continue on failure:** `try/catch` trong vòng lặp — nếu 1 khóa học thất bại, các khóa học còn lại vẫn được xử lý

**Tại sao chạy lúc 5 AM?**
- Ít người dùng online nhất → ít ảnh hưởng performance
- Sau cron #7 (recommendation matrix, 4 AM) — không chồng chéo
- Đủ thời gian để index trước giờ học buổi sáng

### 3.7 Module Wiring (admin.module.ts, jobs.module.ts)

Để `EmbeddingsService` khả dụng trong AdminModule và JobsModule, cần import `AiTutorModule`:

**admin.module.ts:**
```typescript
@Module({
  imports: [AiTutorModule],  // <-- Thêm dòng này
  controllers: [/* ... */],
  providers: [/* ... */],
})
export class AdminModule {}
```

**jobs.module.ts:**
```typescript
@Module({
  imports: [
    BullModule.registerQueue(/* ... */),
    MailModule,
    NotificationsModule,
    RecommendationsModule,
    AiTutorModule,  // <-- Thêm dòng này
  ],
  providers: [/* ... */],
})
export class JobsModule {}
```

NestJS sử dụng **Dependency Injection (DI)** — để inject `EmbeddingsService` vào `AdminCoursesService` hoặc `CronService`, module chứa service đó (`AiTutorModule`) phải được import. `AiTutorModule` cần export `EmbeddingsService` để các module khác sử dụng được.

### 3.8 Frontend Fix — Bảo toàn tin nhắn khi streaming (ai-tutor/page.tsx)

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx`

**Vấn đề:** Khi người dùng gửi tin nhắn, quy trình là:

1. Thêm tin nhắn của user vào `localMessages` (optimistic update)
2. Bắt đầu streaming từ server
3. **Bug:** `useEffect` đồng bộ `sessionMessages` từ server ghi đè `localMessages`, xóa mất tin nhắn của user (vì server chưa lưu xong)

**Nguyên nhân gốc:**

```typescript
// useEffect này chạy mỗi khi sessionMessages thay đổi
useEffect(() => {
  if (sessionMessages) {
    setLocalMessages(/* data từ server */);  // Ghi đè tin nhắn local!
  }
}, [sessionMessages]);
```

Khi streaming bắt đầu, TanStack Query có thể refetch session messages. Lúc này server chưa có tin nhắn mới nhất → `sessionMessages` vẫn là dữ liệu cũ → ghi đè `localMessages` → tin nhắn của user biến mất.

**Fix:** Sử dụng `useRef` để theo dõi trạng thái streaming mà không thay đổi dependency array:

```typescript
const streamingRef = useRef(false);
streamingRef.current = isStreaming || isThinking;

useEffect(() => {
  // Skip sync during streaming to preserve optimistic user message
  if (sessionMessages && !streamingRef.current) {
    setLocalMessages(
      sessionMessages.map((m, i) => ({
        id: m.id ?? `msg-${i}`,
        role: m.role,
        content: m.content,
      })),
    );
  }
}, [sessionMessages]);
```

**Tại sao useRef mà không thêm `isStreaming` vào deps array?**

React hooks có ràng buộc: **dependency array không được thay đổi kích thước** giữa các lần render (ESLint rule `react-hooks/exhaustive-deps`). Thêm `isStreaming` vào deps sẽ gây ra:

1. Effect chạy lại mỗi khi `isStreaming` thay đổi (không cần thiết)
2. Khi `isStreaming` chuyển từ `true` → `false`, effect chạy và ghi đè — vẫn có thể mất tin nhắn nếu timing không đúng

`useRef` là giải pháp chuẩn trong React để **đọc giá trị mới nhất** bên trong effect mà không tạo dependency. `.current` luôn cập nhật đồng bộ, nhưng thay đổi `.current` không trigger re-render hay re-run effect.

### 3.9 Tests

#### cron.service.spec.ts — 3 test mới

**File:** `apps/api/src/modules/jobs/cron/cron.service.spec.ts`

```typescript
describe('indexCoursesForAiTutor', () => {
  it('should index unindexed published courses', async () => {
    prisma.course.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    await service.indexCoursesForAiTutor();

    expect(embeddings.indexCourseContent).toHaveBeenCalledTimes(2);
    expect(embeddings.indexCourseContent).toHaveBeenCalledWith('c1');
    expect(embeddings.indexCourseContent).toHaveBeenCalledWith('c2');
  });

  it('should skip when embeddings model not ready', async () => {
    embeddings.isReady.mockReturnValue(false);
    await service.indexCoursesForAiTutor();

    expect(prisma.course.findMany).not.toHaveBeenCalled();
  });

  it('should continue if one course fails', async () => {
    embeddings.isReady.mockReturnValue(true);
    prisma.course.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    embeddings.indexCourseContent
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    await service.indexCoursesForAiTutor();

    expect(embeddings.indexCourseContent).toHaveBeenCalledTimes(2);
  });
});
```

Test bao phủ 3 tình huống quan trọng:
- **Happy path:** 2 khóa học chưa index → cả 2 được gọi `indexCourseContent`
- **Guard clause:** Model chưa sẵn sàng → không truy vấn database
- **Error resilience:** 1 khóa học lỗi → khóa học còn lại vẫn được xử lý

#### admin-courses.service.spec.ts — Thêm EmbeddingsService mock

```typescript
const embeddings = {
  indexCourseContent: jest.fn().mockResolvedValue(undefined),
};

// Trong TestingModule:
{ provide: EmbeddingsService, useValue: embeddings },
```

Mock `EmbeddingsService` để test `AdminCoursesService` mà không cần model AI thật. `mockResolvedValue(undefined)` mô phỏng indexing thành công.

---

## 4. Flow hoàn chỉnh (Before vs After)

### 4.1 Before (hỏng)

```
Admin publish khóa học
    |
    v
Khóa học có status PUBLISHED, nhưng không có gì xảy ra với AI

    ... (sau đó) ...

Sinh viên hỏi AI Tutor: "Component lifecycle trong React là gì?"
    |
    v
[retrieveContext] SELECT FROM course_chunks WHERE course_id = '...'
    |
    v
Kết quả: 0 rows (bảng rỗng!)
    |
    v
context = "Course content is not yet indexed for AI search."
    |
    v
System prompt: "...COURSE CONTENT:\n---\nCourse content is not yet indexed...\n---"
    |
    v
AI trả lời từ training data chung (không biết khóa học dạy gì cụ thể)
    → Có thể trả lời sai, không sát nội dung khóa học
    → Không thể trích dẫn bài học cụ thể
```

### 4.2 After (hoạt động)

```
Admin publish khóa học
    |
    v
[1] $transaction: status → PUBLISHED, tạo group
    |
    v
[2] Fire-and-forget: indexCourseContent(courseId)
    |
    ├─ Fetch course + sections + chapters + lessons + quizzes
    ├─ Index metadata (title, description, outcomes, prereqs)
    ├─ Index TEXT lessons (kèm chapter context)
    ├─ Index QUIZ lessons (questions + answers + explanations)
    ├─ Index VIDEO lessons (title only)
    ├─ Mỗi phần → chunkText(500, 50) → generateEmbedding → INSERT course_chunks
    v
Bảng course_chunks có 20-100+ chunks (tùy nội dung khóa học)

    ... (sau đó) ...

Sinh viên hỏi AI Tutor: "Component lifecycle trong React là gì?"
    |
    v
[retrieveContext]
    ├─ generateEmbedding("Component lifecycle trong React là gì?")
    ├─ → vector [0.023, -0.114, ...]
    ├─ SELECT content, 1-(embedding <=> vector) AS similarity
    │   FROM course_chunks
    │   WHERE course_id = '...'
    │   ORDER BY embedding <=> vector
    │   LIMIT 5
    v
Top 5 chunks liên quan nhất:
    1. "[React Fundamentals] Component Lifecycle\n[Lesson] useEffect and Lifecycle..."
    2. "[React Fundamentals] Component Lifecycle\n[Quiz] Lifecycle Quiz\nQ: When does..."
    3. "[Course] React Masterclass\nLearning outcomes: - Hiểu Component Lifecycle..."
    4. ...
    |
    v
System prompt: "...COURSE CONTENT:\n---\n[chunk 1]\n---\n[chunk 2]\n---\n...\n---"
    |
    v
AI trả lời dựa trên NỘI DUNG KHÓA HỌC CỤ THỂ:
    → Trích dẫn bài học "useEffect and Lifecycle"
    → Dẫn đáp án từ quiz
    → Sát với những gì khóa học dạy
```

**Ngoài ra, nếu việc index lúc publish thất bại:**

```
Cron job (5 AM hàng ngày)
    |
    v
Tìm courses có status=PUBLISHED + courseChunks: { none: {} }
    |
    v
Index từng khóa học (try/catch cho từng cái)
    → Đảm bảo mọi khóa học published đều được index
```

---

## 5. Kỹ thuật đặc biệt

### 5.1 Fire-and-forget Pattern

```typescript
// KHÔNG có await — response trả về ngay
this.embeddingsService.indexCourseContent(courseId).catch((err: Error) => {
  this.logger.warn(`Failed to index course ${courseId}: ${err.message}`);
});

return result;  // Trả về ngay, không đợi indexing xong
```

**Khi nào dùng fire-and-forget?**
- Công việc phụ, không ảnh hưởng kết quả chính (publish vẫn thành công dù indexing lỗi)
- Công việc mất nhiều thời gian (indexing có thể mất 5-30 giây tùy nội dung)
- Có cơ chế retry (cron job 5 AM)

**Khi nào KHÔNG dùng?**
- Công việc bắt buộc (ví dụ: tạo enrollment sau khi thanh toán — phải await)
- Cần kết quả ngay (ví dụ: generate OTP → trả về cho user)

**Quan trọng:** Phải có `.catch()` để xử lý lỗi. Nếu không, Promise rejection sẽ bị "nuốt" im lặng (trong Node.js mới sẽ báo `unhandledRejection`).

### 5.2 useRef cho stable effect dependencies

```typescript
const streamingRef = useRef(false);
streamingRef.current = isStreaming || isThinking;

useEffect(() => {
  if (sessionMessages && !streamingRef.current) {
    setLocalMessages(/* ... */);
  }
}, [sessionMessages]);  // deps KHÔNG chứa isStreaming
```

**Pattern này được gọi là "Latest Ref Pattern"** — phổ biến trong React khi cần:
1. Đọc giá trị mới nhất bên trong callback/effect
2. Nhưng KHÔNG muốn giá trị đó trigger re-run effect

**useRef vs useState:**
| | useState | useRef |
|---|---|---|
| Thay đổi trigger re-render | Có | Không |
| Thay đổi trigger effect re-run | Có (nếu trong deps) | Không |
| Đọc giá trị mới nhất | Sau re-render | Ngay lập tức |
| Use case | UI state | Giá trị tham chiếu, DOM refs |

### 5.3 Cosine Similarity Search với pgvector

```sql
SELECT content, 1 - (embedding <=> ${embeddingStr}::vector) AS similarity
FROM course_chunks
WHERE course_id = ${courseId}
ORDER BY embedding <=> ${embeddingStr}::vector
LIMIT 5
```

**Cách hoạt động:**
1. `${embeddingStr}::vector` — cast chuỗi `"[0.1, 0.2, ...]"` thành kiểu vector của pgvector
2. `embedding <=> ...` — tính cosine distance (0 = giống, 2 = khác biệt)
3. `1 - distance` = cosine similarity (dễ đọc hơn: 1 = giống, -1 = khác)
4. `ORDER BY distance ASC` — lấy chunk giống nhất trước
5. `LIMIT 5` — chỉ lấy 5 chunk tốt nhất để không vượt quá context window của LLM

**Performance:** pgvector hỗ trợ index IVFFlat hoặc HNSW để tăng tốc tìm kiếm trên dữ liệu lớn. Với vài ngàn chunks, sequential scan vẫn đủ nhanh.

### 5.4 Chunking với Overlap

```typescript
private chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
  }
  return chunks;
}
```

**Ví dụ cụ thể** với text 1200 ký tự, chunkSize=500, overlap=50:

```
Chunk 1: text[0..500]      (500 ký tự)
Chunk 2: text[450..950]    (500 ký tự, 50 ký tự đầu trùng với chunk 1)
Chunk 3: text[900..1200]   (300 ký tự, 50 ký tự đầu trùng với chunk 2)
```

Tổng: 3 chunks. Overlap đảm bảo:
- Câu bị cắt giữa 2 chunk sẽ xuất hiện đầy đủ ở ít nhất 1 chunk
- Ngữ cảnh không bị mất đột ngột tại điểm cắt

### 5.5 SSE Timeout Handling

**Server-Sent Events (SSE)** là kỹ thuật cho phép server gửi dữ liệu liên tục qua 1 kết nối HTTP:

```
Client                    Server
  |--- POST /ask-stream ---->|
  |                          | (AI đang suy nghĩ...)
  |<--- data: {start} ------|
  |<--- data: {token: "T"} -|
  |<--- data: {token: "h"} -|
  |<--- data: {token: "e"} -|
  |         ...              |
  |<--- data: {done} -------|
  |--- Connection closed --->|
```

**Headers cần thiết:**

```typescript
res.setHeader('Content-Type', 'text/event-stream');  // SSE MIME type
res.setHeader('Cache-Control', 'no-cache');           // Không cache
res.setHeader('Connection', 'keep-alive');             // Giữ kết nối
res.flushHeaders();                                    // Gửi headers ngay
```

**Vấn đề timeout:** Express/NestJS có default timeout. Nếu AI mất 3 phút để suy nghĩ + stream, kết nối bị đóng giữa chừng. `req.setTimeout(0)` tắt timeout **chỉ cho request này**.

**Định dạng SSE:** Mỗi event là một dòng bắt đầu bằng `data: ` và kết thúc bằng 2 newline:

```typescript
res.write(`data: ${JSON.stringify(event)}\n\n`);
```

Frontend đọc từng event qua `fetch` + `ReadableStream` hoặc `EventSource`.

---

## 6. Tổng kết các file thay đổi

| File | Thay đổi | Mục đích |
|------|---------|---------|
| `embeddings.service.ts` | Viết lại `indexCourseContent()` + thêm `insertChunks()`, `stripHtml()` | Index 4 nguồn nội dung thay vì chỉ TEXT |
| `ai-tutor.service.ts` | Cải thiện `buildMessages()` system prompt | 7 quy tắc hành vi cho AI |
| `ai-tutor.controller.ts` | Thêm `POST index/:courseId` + `req.setTimeout(0)` | Manual index + fix SSE timeout |
| `admin-courses.service.ts` | Thêm `indexCourseContent` fire-and-forget khi publish | Tự động index khi publish |
| `admin.module.ts` | Import `AiTutorModule` | Cho phép DI EmbeddingsService |
| `jobs.module.ts` | Import `AiTutorModule` | Cho phép DI EmbeddingsService |
| `cron.service.ts` | Thêm cron #10 `indexCoursesForAiTutor` | Index khóa học chưa index hàng ngày |
| `cron.service.spec.ts` | 3 test mới | Test cron indexing |
| `admin-courses.service.spec.ts` | Thêm EmbeddingsService mock | Test publish + indexing |
| `ai-tutor/page.tsx` | `useRef(streamingRef)` | Fix mất tin nhắn khi streaming |

# Explanation — Phase 5.14c: Course Wizard & Curriculum Editor

> Giải thích chi tiết các pattern, quyết định thiết kế, và bug fixes trong Phase 5.14c.
> Đây là sub-phase phức tạp nhất của toàn bộ frontend vì phải quản lý
> nhiều tầng state (wizard steps, local curriculum, batch save) và nhiều loại media upload.

---

## 1. PATTERN: Hybrid Local + Server State cho Curriculum Editor

### Tại sao không dùng TanStack Query trực tiếp?

TanStack Query rất tốt cho **đọc dữ liệu** từ server. Nhưng curriculum editor cần
**nhiều thao tác edit liên tiếp** trước khi lưu:

```
User: Thêm section → đặt tên → thêm chapter → thêm 3 lesson → sắp xếp lại
→ User chưa muốn lưu ngay, chỉ muốn lưu khi ấn "Next"
```

Nếu dùng TanStack Query mutation cho mỗi thao tác → mỗi action gọi 1 API call →
- Chậm (mỗi action phải đợi network)
- Lãng phí (user có thể rename section 3 lần liên tiếp)
- 429 Too Many Requests (quá nhiều request liên tiếp)

**Giải pháp: Hybrid pattern**
- **Server state** (TanStack Query): `useInstructorCourseDetail(courseId)` — source of truth ban đầu
- **Local state** (React useState): tất cả thay đổi pending
- **Batch save**: khi ấn Next, diff local vs server → chỉ gọi API cho những gì thực sự changed

```typescript
interface LocalSection {
  id?: string;         // undefined = chưa POST lên server
  tempId: string;      // client-side key cho React, luôn có
  isNew?: boolean;     // cần POST
  isModified?: boolean; // cần PATCH
  isDeleted?: boolean;  // cần DELETE
  // ... fields
}
```

`tempId` là UUID tạo ở client, dùng làm React `key`. Nó tồn tại ngay cả khi `id` chưa có
(chưa tạo trên server). Sau khi POST thành công → `id` được set, `tempId` giữ nguyên.

---

## 2. PATTERN: Single Invalidation sau Batch Save (429 Fix)

### Vấn đề gốc rễ

Ban đầu mỗi mutation hook có `onSuccess` invalidation:
```typescript
// use-sections.ts (cách cũ — SAI)
export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sectionService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
      // ↑ Mỗi mutation trigger 1 re-fetch
    },
  });
}
```

Batch save 3 sections + 5 chapters + 10 lessons = **18 consecutive invalidations**.
Mỗi invalidation trigger 1 `GET /instructor/courses/:id` request.
Backend ThrottlerModule limit 3 req/s → block → **HTTP 429**.

### Fix: Tách biệt "mutation" và "invalidation"

Mutation hooks **chỉ làm 1 việc**: gọi API. Không tự invalidate.

```typescript
// use-sections.ts (cách đúng)
export function useCreateSection() {
  return useMutation({
    mutationFn: sectionService.create,
    onError: (error) => toast.error(/* ... */),
    // KHÔNG có onSuccess invalidation
  });
}
```

Batch save tự quản lý invalidation:
```typescript
async function saveCurriculum() {
  // ... tất cả mutation calls ...

  // Duy nhất 1 invalidation ở cuối:
  queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
}
```

**Nguyên tắc tổng quát:** Khi bạn biết sẽ gọi N mutations liên tiếp, hãy
invalidate một lần ở cuối thay vì N lần trong mỗi `onSuccess`.

---

## 3. PATTERN: Quiz Builder như Controlled Component

### Tại sao QuizBuilder không tự save?

Quiz cần `lessonId` để call `PUT /lessons/:lessonId/quiz`.
Với **new lessons**, `lessonId` chưa tồn tại cho đến khi POST lesson thành công.

Timeline của "tạo quiz lesson mới":
```
1. User opens LessonDialog → chọn QUIZ type
2. User xây dựng quiz questions trong QuizBuilder
3. User ấn "Save" trong dialog → lesson được thêm vào LOCAL state
4. User ấn "Next" trong step curriculum → BATCH SAVE bắt đầu
5. POST /chapters/:chapterId/lessons { type: QUIZ, ... } → nhận về lessonId
6. PUT /lessons/:lessonId/quiz { questions: [...] } → quiz saved
```

Nếu QuizBuilder tự save (cách cũ), step 2 sẽ fail vì `lessonId` chưa có ở step này.

**Fix: QuizBuilder = controlled component**
```typescript
interface QuizBuilderProps {
  value?: QuizFormValues;          // Data từ parent
  onChange: (data: QuizFormValues) => void; // Notify parent khi thay đổi
  readOnly?: boolean;
}
```

Data flow:
```
QuizBuilder.onChange → LessonDialog state (quizData)
→ LocalLesson.quizData
→ Batch save: lesson POST → quiz PUT (with lessonId from POST response)
```

---

## 4. PATTERN: Key-Based Remount cho LessonDialog

### Vấn đề: React Component Instance Reuse

React tái sử dụng component instances khi cùng component ở cùng vị trí trong tree.
`LessonDialog` luôn render ở cùng 1 vị trí trong `StepCurriculum`.

Khi user edit lesson A (QUIZ type) rồi mở lesson B (cũng QUIZ type):
- React thấy cùng `<LessonDialog>` → **reuse instance**
- `QuizBuilder` internal state (`useFieldArray`) → **giữ nguyên questions của lesson A**
- User đang xem questions của lesson A nhưng nghĩ là lesson B → BUG

### Fix: key prop để force remount

```tsx
<LessonDialog
  key={lesson?.tempId ?? (open ? 'new' : 'closed')}
  lesson={lesson}
  open={open}
  // ...
/>
```

Logic của key:
- Khi edit **lesson cụ thể**: `key = lesson.tempId` (mỗi lesson có tempId riêng)
- Khi tạo **lesson mới**: `key = 'new'` (constant)
- Khi dialog đóng: `key = 'closed'` (để reset state sau khi close)

Mỗi khi key thay đổi → React **unmount hoàn toàn** component cũ → **mount mới** → state sạch.

**Khi nào dùng key-based remount?**
- Component có internal state phức tạp (useFieldArray, deep nested state)
- Không muốn/không thể reset state thủ công trong useEffect
- Performance chấp nhận được (dialog, modal — không render liên tục)

---

## 5. PATTERN: Self-Contained Portal cho Dialog

### Vấn đề: CSS Transform và `position: fixed`

Spec CSS: `position: fixed` được positioned relative to **initial containing block**
(viewport), TRỪ KHI ancestor có `transform`, `perspective`, hoặc `filter`.

Sidebar layout dùng CSS transition (animation):
```css
.sidebar { transform: translateX(-100%); transition: transform 0.3s; }
.sidebar.open { transform: translateX(0); }
```

Khi sidebar có `transform: translateX(0)` → nó tạo **new containing block**.
Dialog (con của sidebar) có `position: fixed` → positioned relative to **sidebar**, không phải viewport.
Kết quả: dialog render ở góc trái dưới sidebar, không phải center màn hình.

### Fix: ReactDOM.createPortal ra document.body

```typescript
import * as ReactDOM from 'react-dom';

if (!open) return null;
return ReactDOM.createPortal(
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="relative z-10 bg-card rounded-xl ...">
      {children}
    </div>
  </div>,
  document.body, // Render trực tiếp vào body, thoát khỏi sidebar
);
```

Portal render content ở **bất kỳ DOM node nào** trong khi giữ React context tree.
`document.body` không có `transform` → `position: fixed` hoạt động đúng.

### Z-index stacking

Khi có nested dialogs (LessonDialog → ImportQuizDialog):
```
document.body
  └── LessonDialog portal (z-[9999])
      └── (React tree chứa ImportQuizDialog)
          └── ImportQuizDialog portal (z-[10000])
```

ImportQuizDialog dùng `z-[10000]` để đảm bảo render trên LessonDialog.

### Tại sao LessonDialog dùng custom portal, không dùng shared Dialog?

Shared `Dialog` component (`packages/shared-ui`) cũng đã được update thêm portal,
nhưng Turbopack bundling tạo ra edge cases với hydration. LessonDialog là component
quan trọng nhất (user spend nhiều thời gian ở đây) → dùng custom implementation
để tránh dependency issues.

---

## 6. PATTERN: videoUrl Trực Tiếp trên Lesson Model

### Tại sao không dùng Media table?

Kiến trúc ban đầu plan dùng `Media` table riêng:
```
Lesson → Media (via lessonId FK)
Media: { id, publicId, secureUrl, duration, ... }
```

Vấn đề:
1. Để lấy `videoUrl`, phải join Lesson + Media
2. Upload flow phức tạp: `POST /uploads/sign` → upload Cloudinary → `POST /uploads/:id/complete` → link đến lesson
3. API response của `/instructor/courses/:id` cần include Media join

**Lesson chỉ có 1 video** (không phải multi-media). Media table hữu ích hơn cho
attachments (1 lesson có nhiều files). Với video, direct FK đơn giản hơn nhiều.

**Fix: Add `videoUrl String?` trực tiếp vào Lesson**

```prisma
model Lesson {
  id               String   @id @default(cuid())
  title            String
  type             LessonType
  textContent      String?
  videoUrl         String?  // ← Added in migration 20260321000000_add_lesson_video_url
  estimatedDuration Int?
  // ...
}
```

Upload flow đơn giản hơn:
1. `VideoUpload` component: upload trực tiếp lên Cloudinary
2. Lấy `secureUrl` từ Cloudinary response
3. Lưu `videoUrl = secureUrl` vào local lesson state
4. Batch save: send `videoUrl` trong body của `POST /lessons`

---

## 7. PATTERN: RichTextEditor với 3 Tabs

### Tại sao cần 3 tabs?

**Tab 1: Edit (WYSIWYG)**
- Tiptap editor: user thấy formatted text
- Toolbar: Bold, Italic, H2, H3, BulletList, OrderedList, Link, Undo, Redo
- Vấn đề: user không biết HTML đằng sau trông như thế nào

**Tab 2: Preview (rendered HTML)**
- Render HTML bằng `dangerouslySetInnerHTML`
- `@tailwindcss/typography` plugin cung cấp `prose dark:prose-invert` classes
- User thấy đúng như học sinh sẽ thấy
- Đặc biệt hữu ích cho code blocks, tables, links

**Tab 3: HTML (raw source)**
- `<textarea>` hiển thị raw HTML
- Advanced users có thể paste HTML trực tiếp
- Debug view khi WYSIWYG render không như ý

### `@tailwindcss/typography` plugin

Package này cung cấp `prose` class — reset styling cho rendered HTML:
```html
<div class="prose dark:prose-invert max-w-none">
  <!-- HTML content renders với typography styles -->
  <h2>Tiêu đề</h2>
  <p>Đoạn văn có <strong>bold</strong></p>
  <ul><li>Item 1</li></ul>
</div>
```

Không có plugin này, `<h2>` từ Tiptap sẽ render không có styling vì Tailwind reset.

### ReadOnly mode

```typescript
const editor = useEditor({
  extensions: [...],
  editable: !readOnly,  // Tiptap native readonly
  immediatelyRender: false, // SSR compatibility
});

// Toolbar ẩn khi readOnly
{!readOnly && <EditorToolbar editor={editor} />}
```

---

## 8. PATTERN: Move Up/Down Reorder (thay vì Drag & Drop)

### Tại sao không dùng Drag & Drop?

DnD libraries (react-beautiful-dnd, @dnd-kit/core) thêm:
- Dependencies (~50KB)
- Setup phức tạp (providers, sensors, collision detection)
- Accessibility concerns
- Khó test

Move Up/Down buttons đơn giản hơn và đủ dùng cho thesis project.

### Implementation

```typescript
function moveSection(tempId: string, direction: 'up' | 'down') {
  setSections(prev => {
    const idx = prev.findIndex(s => s.tempId === tempId);
    if (direction === 'up' && idx === 0) return prev; // Already first
    if (direction === 'down' && idx === prev.length - 1) return prev; // Already last

    const newSections = [...prev];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];

    // Update order values
    return newSections.map((s, i) => ({ ...s, order: i + 1, isModified: s.id ? true : s.isModified }));
  });
}
```

Buttons disabled khi item đã ở đầu/cuối list:
```tsx
<Button disabled={idx === 0} onClick={() => moveSection(s.tempId, 'up')}>
  <ArrowUp />
</Button>
<Button disabled={idx === sections.length - 1} onClick={() => moveSection(s.tempId, 'down')}>
  <ArrowDown />
</Button>
```

---

## 9. PATTERN: ReadOnly cho PENDING_REVIEW

### Tại sao cần ReadOnly?

Khi course đang được admin review (`PENDING_REVIEW`), instructor không được phép
chỉnh sửa content vì:
1. Admin đang review một version cụ thể — nếu instructor sửa, admin review sẽ không chính xác
2. Backend cũng reject các updates khi course ở trạng thái `PENDING_REVIEW`

### `<fieldset disabled>` approach

HTML `<fieldset disabled>` disable tất cả form elements con:
```tsx
<fieldset disabled={isReadOnly} className="contents">
  <Input ... />
  <Select ... />
  <Textarea ... />
  {/* Tất cả đều disabled khi isReadOnly = true */}
</fieldset>
```

`className="contents"` để `fieldset` không tạo thêm layout box (display: contents).

Ưu điểm so với disable từng field riêng lẻ:
- Một nơi duy nhất để control readOnly
- Không bỏ sót field nào
- HTML semantic (fieldset là container form controls)

### Custom components cần xử lý riêng

`<fieldset disabled>` chỉ work với native form elements. Custom components cần prop riêng:
- `RichTextEditor`: nhận `readOnly` prop → `editable: !readOnly` trong Tiptap
- `ImageUpload`, `VideoUpload`: kiểm tra `disabled` từ fieldset context (hoặc nhận prop riêng)

---

## 10. BACKEND CHANGES: @Public() và @SkipThrottle()

### @Public() trên GET endpoints

Sections, chapters, lessons GET endpoints cần public access vì:
- Student portal cần browse course structure (trước khi enroll)
- Course detail page cần load curriculum

```typescript
@Get()
@Public()  // Override JwtAuthGuard
@ApiOperation({ summary: 'Get course sections (public)' })
async findAll(@Param('courseId') courseId: string) {
  return this.sectionsService.findAll(courseId);
}
```

POST/PATCH/DELETE vẫn require `@UseGuards(JwtAuthGuard)` + `INSTRUCTOR` role.

### @SkipThrottle() trên CRUD endpoints

`ThrottlerModule` rate limit (ví dụ 10 req/30s) hợp lý cho public endpoints.
Nhưng batch save curriculum của instructor (authenticated, authorized) có thể cần
gọi 20+ mutations trong vài giây.

`@SkipThrottle()` bypass throttle cho controller hoặc method cụ thể.
Safe vì endpoints đã require auth + role — chỉ INSTRUCTOR mới reach đây.

---

## 11. BUG FIX DEEP DIVE: 429 Too Many Requests

### Root Cause Analysis

```
Batch save (3 sections + 5 chapters + 10 lessons = 18 items):

Timeline:
t=0ms:   POST /sections/1 → onSuccess → invalidateQueries → GET /courses/:id
t=50ms:  POST /sections/2 → onSuccess → invalidateQueries → GET /courses/:id
t=100ms: POST /sections/3 → onSuccess → invalidateQueries → GET /courses/:id
t=150ms: POST /chapters/1 → onSuccess → invalidateQueries → GET /courses/:id
...
t=850ms: POST /lessons/10 → onSuccess → invalidateQueries → GET /courses/:id

= 18 GET /courses/:id requests in 850ms
= ~21 requests/second
> ThrottlerModule limit
→ 429 Too Many Requests
```

### Solution và Alternatives

**Chosen fix:** Remove `onSuccess` invalidation từ mutation hooks, single invalidation at end.

**Alternative 1 — Debounced invalidation:**
```typescript
const debouncedInvalidate = useDebounce(
  () => queryClient.invalidateQueries(...),
  500
);
// onSuccess: debouncedInvalidate()
```
→ Vẫn invalidate sau mỗi mutation nhưng debounced. Phức tạp hơn, ít predictable.

**Alternative 2 — Increase throttle limit:**
```typescript
// throttler.module config
limit: 100, // from 10
```
→ Workaround, không giải quyết root cause.

**Alternative 3 — @SkipThrottle() only:**
→ Giải quyết 429 nhưng vẫn gây 18 unnecessary re-fetches (performance waste).

**Chosen fix là tốt nhất** vì: giải quyết root cause, simple, và đúng pattern
(bulk operations nên invalidate một lần ở cuối).

---

## 12. BUG FIX DEEP DIVE: Dialog Portal

### CSS Transform Containing Block Spec

Từ CSS Transforms Spec Level 1:
> "If the element has a transformation matrix... it establishes a containing block
> for fixed positioned descendants."

Tức là: ancestor có `transform != none` → break `position: fixed`.

Sidebar layout:
```tsx
<aside className="... transition-transform ...">
  {/* sidebar content */}
  <StepCurriculum>
    <LessonDialog />  {/* position: fixed không work ở đây */}
  </StepCurriculum>
</aside>
```

### Attempted Fix 1: createPortal trong shared Dialog

```typescript
// dialog.tsx
return createPortal(
  <DialogBackdrop>
    <DialogPanel>{children}</DialogPanel>
  </DialogBackdrop>,
  document.body
);
```

**Vấn đề:** Dialog trigger button là `<DialogTrigger>`. Khi click trigger, nó
toggle dialog state. Backdrop `onClick` cũng toggle. Khi click trigger:
1. Trigger onClick → open dialog
2. Event bubbles lên → backdrop onClick → close dialog
3. Net effect: dialog flashes open/close → không thể mở

Fix cần `stopPropagation` nhưng location không consistent với Radix UI primitives.

### Final Fix: Self-Contained Portal

Bypass shared Dialog hoàn toàn. Tự quản lý open/close state với click-outside:

```typescript
// lesson-dialog.tsx
if (!open) return null;

return ReactDOM.createPortal(
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center"
    onMouseDown={(e) => {
      // Only close if clicking backdrop (not panel)
      if (e.target === e.currentTarget) onClose();
    }}
  >
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black/50" />
    {/* Panel */}
    <div
      className="relative z-10 bg-card rounded-xl shadow-xl ..."
      onMouseDown={(e) => e.stopPropagation()} // Prevent backdrop close
    >
      {children}
    </div>
  </div>,
  document.body,
);
```

Dùng `onMouseDown` thay vì `onClick` để tránh race condition với drag actions.

---

## 13. FILES TẠO MỚI VÀ SỬA ĐỔI

### packages/shared-hooks

**Mới:**
- `src/services/section.service.ts` — CRUD functions cho sections
- `src/services/chapter.service.ts` — CRUD functions cho chapters (includes sectionId)
- `src/services/lesson.service.ts` — CRUD functions cho lessons (includes videoUrl)
- `src/services/quiz.service.ts` — GET + upsert + delete quiz
- `src/services/upload.service.ts` — sign + complete + delete uploads
- `src/queries/use-sections.ts` — mutation hooks, NO onSuccess invalidation
- `src/queries/use-chapters.ts` — mutation hooks, NO onSuccess invalidation
- `src/queries/use-lessons.ts` — mutation hooks, NO onSuccess invalidation
- `src/queries/use-quiz.ts` — query + mutation hooks (quiz CAN invalidate, small data)
- `src/queries/use-categories.ts` — categories list, staleTime 10min

**Sửa đổi:**
- `src/services/index.ts` — export 5 new services
- `src/index.ts` — export new query hooks

### apps/management-portal/src

**Mới:**
- `lib/validations/course.ts` — Zod schemas: courseBasicsSchema, coursePricingSchema, sectionSchema, chapterSchema, lessonSchema, quizSchema
- `lib/cloudinary.ts` — uploadToCloudinary (XHR + progress), uploadWithSignedParams
- `components/courses/wizard/course-wizard.tsx` — wizard container, step state, isReadOnly logic
- `components/courses/wizard/step-basics.tsx` — Step 1, fieldset readOnly, VideoUpload for promo
- `components/courses/wizard/step-curriculum.tsx` — Step 2, local state, move up/down, batch save + single invalidation
- `components/courses/wizard/step-pricing.tsx` — Step 3, chapter pricing table, fieldset readOnly
- `components/courses/wizard/step-review.tsx` — Step 4, completeness checklist, submit
- `components/courses/wizard/lesson-dialog.tsx` — portal + key remount + fieldset readOnly
- `components/courses/wizard/quiz-builder.tsx` — controlled component, onChange pattern
- `components/courses/wizard/import-quiz-dialog.tsx` — portal z-10000, text parser
- `components/courses/rich-text-editor.tsx` — 3 tabs (Edit/Preview/HTML), readOnly prop
- `components/courses/image-upload.tsx` — aspect-video 16:9, max 25MB
- `components/courses/video-upload.tsx` — aspect-video 16:9, duration extraction
- `components/courses/detail/course-info-card.tsx` — course detail info display
- `components/courses/detail/course-stats.tsx` — PUBLISHED courses only stats
- `components/courses/detail/course-curriculum.tsx` — read-only tree with lesson buttons
- `components/courses/detail/lesson-detail-dialog.tsx` — video/text/quiz preview
- `app/[locale]/instructor/courses/[courseId]/page.tsx` — course detail page

**Sửa đổi:**
- `app/[locale]/instructor/courses/new/page.tsx` — rewrite sang CourseWizard
- `app/[locale]/instructor/courses/[courseId]/edit/page.tsx` — rewrite sang CourseWizard
- `components/navigation/breadcrumb.tsx` — CourseTitle component, CUID detection
- `components/feedback/confirm-dialog.tsx` — uses shared Dialog (with portal)
- `messages/vi.json` — courseWizard namespace, apiErrors ~80 codes, nav additions
- `messages/en.json` — courseWizard namespace, apiErrors ~80 codes, nav additions

### apps/api/src

**Sửa đổi:**
- `prisma/schema.prisma` — `videoUrl String?` on Lesson
- `prisma/migrations/20260321000000_add_lesson_video_url/migration.sql` — ADD COLUMN
- `modules/courses/sections/sections.controller.ts` — `@SkipThrottle()` + `@Public()` on GET
- `modules/courses/chapters/chapters.controller.ts` — `@SkipThrottle()` + `@Public()` on GET
- `modules/courses/lessons/lessons.controller.ts` — `@SkipThrottle()` + `@Public()` on GET
- `modules/courses/lessons/dto/create-lesson.dto.ts` — `@IsOptional() @IsUrl() videoUrl?: string`
- `modules/courses/lessons/dto/update-lesson.dto.ts` — same

### packages/shared-ui

**Sửa đổi:**
- `src/components/dialog.tsx` — createPortal added for ConfirmDialog use case

---

## 14. KEY LEARNINGS

### 1. Batch operations cần single invalidation ở cuối

Anti-pattern: invalidate trong mỗi `onSuccess` của mutation.
Correct: collect tất cả mutations, execute, invalidate một lần.

### 2. CSS transform breaks position:fixed

Bất kỳ ancestor nào có `transform != none` sẽ break `position: fixed` của descendants.
Giải pháp: `ReactDOM.createPortal(content, document.body)`.

### 3. Controlled vs Uncontrolled Components

Khi component cần data từ parent để hoạt động (ví dụ: QuizBuilder cần `lessonId` để save),
làm nó **controlled** (data qua props, notify changes qua `onChange`).
Đừng để component tự fetch/save nếu nó cần context mà chưa có.

### 4. key prop để force remount

Khi cần reset phức tạp internal state, dùng `key` prop thay vì `useEffect` cleanup.
Simpler, more reliable, và rõ ràng về intent.

### 5. videoUrl trực tiếp trên model khi relationship là 1-1 bắt buộc

Đừng tạo separate table chỉ để store 1 URL field. Media table hữu ích cho
attachments (1-many), không phải cho video URL (1-1 hoặc 0-1).

### 6. `<fieldset disabled>` cho readonly forms

Đơn giản hơn disable từng field riêng lẻ. Một điểm control duy nhất.
Kết hợp với `className="contents"` để tránh layout side effects.

### 7. @SkipThrottle() cho authenticated bulk operations

Rate limiting hữu ích cho unauthenticated endpoints. Với endpoints đã require
authentication + role, throttle có thể gây friction cho legitimate bulk operations.
`@SkipThrottle()` + auth guard = best of both worlds.

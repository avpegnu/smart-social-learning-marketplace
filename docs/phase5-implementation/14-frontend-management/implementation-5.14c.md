# Phase 5.14c — Course Wizard & Curriculum Editor

> Multi-step course creation/editing wizard with "save per step" pattern,
> curriculum editor (sections → chapters → lessons), quiz builder,
> Cloudinary uploads, Tiptap rich text editor, and course detail view.
> This is the MOST complex sub-phase of the entire frontend.

---

## 1. DESIGN DECISIONS

### 1.1 Save per step (NOT auto-save, NOT save per field)

**Research:** Udemy dùng auto-save per section, Teachable dùng manual save per page,
Skillshare dùng save per step. Với thesis project, **save per step** là approach tốt nhất:

- User edit form → dữ liệu giữ trong **React state** (form/local state)
- Khi ấn **"Next"** hoặc **"Save Draft"** → call API lưu lên server
- Khi ấn **"Previous"** → state giữ nguyên trong memory (không mất)
- Khi **F5/close tab** → unsaved changes mất (acceptable, có `beforeunload` warning)

### 1.2 Create vs Edit mode

| Scenario | Step 1 action | Step 2+ action |
|----------|--------------|----------------|
| **Create new** | Validate → `POST /instructor/courses` → get `courseId` → redirect `/courses/:id/edit?step=2` | Dùng `courseId` cho section/chapter/lesson CRUD |
| **Edit existing** | Load `GET /courses/:id` → pre-fill form → `PATCH /courses/:id` on Next | Dùng `courseId` có sẵn |

**Tại sao redirect sang `/edit`?** Để URL luôn có `courseId` — nếu user F5 giữa chừng,
page load lại từ server với đúng course data.

### 1.3 Curriculum — hybrid local + server state

Curriculum (Step 2) dùng **hybrid approach**:
- **Server state** là source of truth — load từ `GET /courses/:id` (sections → chapters → lessons)
- **Local state** cho pending changes — user thêm/sửa/xóa section/chapter/lesson
- **Batch sync** khi ấn **Save/Next** — diff local vs server, call APIs cho changes

```typescript
interface LocalSection {
  id?: string;        // undefined = chưa tạo trên server
  tempId: string;     // client-side ID cho React key
  title: string;
  order: number;
  isNew?: boolean;    // cần POST
  isModified?: boolean; // cần PATCH
  isDeleted?: boolean;  // cần DELETE
  chapters: LocalChapter[];
}

interface LocalLesson {
  // ... common fields
  videoUrl?: string;   // stored directly (no Media table)
  quizData?: QuizFormValues; // buffered quiz, saved after lesson created
}
```

**Exception — VIDEO lessons:**
When creating a VIDEO lesson, video is uploaded to Cloudinary immediately (file binary
cannot be stored in React state). The `videoUrl` and `duration` are stored in local
lesson state. When batch saving, the lesson is created with `videoUrl` and
`estimatedDuration` from the upload result.

**Exception — QUIZ lessons:**
QuizBuilder does NOT self-save. It exposes data via `onChange` callback. Quiz data
is stored in `LocalLesson.quizData`. When batch saving, quiz is saved AFTER the lesson
record is created (requires `lessonId`).

### 1.4 Single invalidation at batch save end (429 fix)

**Problem:** Each mutation hook (useCreateSection, useCreateChapter, etc.) originally
called `queryClient.invalidateQueries` in `onSuccess`. Batch save with N sections +
M chapters + K lessons = (N + M + K) invalidations → rapid consecutive re-fetches →
HTTP 429 Too Many Requests from backend.

**Fix:** Removed `onSuccess` invalidation from ALL section/chapter/lesson mutation hooks.
Batch save calls `queryClient.invalidateQueries(['instructor', 'courses', courseId])`
exactly ONCE at the end, after all mutations complete. This is the correct pattern for
bulk operations.

### 1.5 Navigation between steps

| Action | Behavior |
|--------|----------|
| Step 1 → Next | Validate form → save to server → go Step 2 |
| Step 2 → Previous | **Keep curriculum local state** in parent → go Step 1 |
| Step 1 → Next (back from 2) | Validate → save → go Step 2 **with local state preserved** |
| Step 2 → Next | **Batch save** curriculum → single invalidation → go Step 3 |
| Step 3 → Previous | **Keep pricing state** → go Step 2 |
| Step 3 → Next | Save pricing → go Step 4 |
| Step 4 → Previous | Go Step 3 with state |
| Any step → "Save Draft" | Save current step only |

### 1.6 ReadOnly for PENDING_REVIEW courses

Courses with `status === 'PENDING_REVIEW'` are under admin review and must not be
edited. All 3 editable steps (Basics, Curriculum, Pricing) use `<fieldset disabled={isReadOnly}>`.

Additional handling:
- `RichTextEditor` receives `readOnly` prop → sets Tiptap `editable: false` + hides toolbar
- Save/Next buttons hidden when `isReadOnly`, only "Next" (non-saving navigation) is shown
- Step 4 (Review) remains accessible for read-only inspection

---

## 2. BACKEND API REFERENCE

### Course Management — `instructor/courses`

| Method | Route | Purpose | Body |
|--------|-------|---------|------|
| POST | `/instructor/courses` | Create draft | `{ title, shortDescription?, description?, categoryId?, level?, language?, price?, thumbnailUrl?, promoVideoUrl?, learningOutcomes?, prerequisites?, tags? }` |
| PATCH | `/instructor/courses/:id` | Update | Partial (same fields) |
| GET | `/instructor/courses/:id` | Full detail | Returns nested: sections → chapters → lessons |
| DELETE | `/instructor/courses/:id` | Soft delete | — |
| POST | `/instructor/courses/:id/submit` | Submit review | Validates completeness |

### Sections — `instructor/courses/:courseId/sections`

Decorated with `@SkipThrottle()` and `@Public()` (for public browsing GET).

| Method | Route | Body |
|--------|-------|------|
| POST | `.../sections` | `{ title, order? }` |
| PATCH | `.../sections/:sectionId` | `{ title?, order? }` |
| DELETE | `.../sections/:sectionId` | — |
| PUT | `.../sections/reorder` | `{ orderedIds: string[] }` |

### Chapters — `instructor/courses/:courseId/sections/:sectionId/chapters`

Decorated with `@SkipThrottle()` and `@Public()` (for public browsing GET).
⚠️ Route includes **sectionId** — ALL chapter endpoints need it.

| Method | Route | Body |
|--------|-------|------|
| POST | `.../sections/:sectionId/chapters` | `{ title, description?, price?, isFreePreview?, order? }` |
| PATCH | `.../sections/:sectionId/chapters/:chapterId` | `{ title?, description?, price?, isFreePreview? }` |
| DELETE | `.../sections/:sectionId/chapters/:chapterId` | — |
| PUT | `.../sections/:sectionId/chapters/reorder` | `{ orderedIds: string[] }` |

### Lessons — `instructor/courses/:courseId/chapters/:chapterId/lessons`

Decorated with `@SkipThrottle()` and `@Public()` (for public browsing GET).
⚠️ Route includes **chapterId** — ALL lesson endpoints need it.

| Method | Route | Body |
|--------|-------|------|
| POST | `.../chapters/:chapterId/lessons` | `{ title, type, textContent?, videoUrl?, estimatedDuration?, order? }` |
| PATCH | `.../chapters/:chapterId/lessons/:lessonId` | `{ title?, type?, textContent?, videoUrl?, estimatedDuration? }` |
| DELETE | `.../chapters/:chapterId/lessons/:lessonId` | — |
| PUT | `.../chapters/:chapterId/lessons/reorder` | `{ orderedIds: string[] }` |

⚠️ `videoUrl` is stored directly on the Lesson model (NOT via Media table).
Prisma migration `20260321000000_add_lesson_video_url` added this field.
Lesson DTOs (`CreateLessonDto`, `UpdateLessonDto`) include `videoUrl?: string`.

### Quiz — `instructor/courses/:courseId/lessons/:lessonId/quiz`

| Method | Route | Body |
|--------|-------|------|
| PUT | `.../lessons/:lessonId/quiz` | `{ passingScore?, maxAttempts?, timeLimitSeconds?, questions: [{ question, explanation?, options: [{ text, isCorrect }] }] }` |
| GET | `.../lessons/:lessonId/quiz` | — |
| DELETE | `.../lessons/:lessonId/quiz` | — |

### Uploads — `uploads`

| Method | Route | Body |
|--------|-------|------|
| POST | `/uploads/sign` | `{ type: 'VIDEO'|'IMAGE'|'ATTACHMENT', lessonId?, folder? }` |
| POST | `/uploads/:mediaId/complete` | `{ cloudinaryResult: { publicId, secureUrl, duration?, format, bytes } }` |
| DELETE | `/uploads/:mediaId` | — |

### Categories — `categories` (Public)

| Method | Route | Response |
|--------|-------|----------|
| GET | `/categories` | `[{ id, name, slug, children: [...] }]` |

---

## 3. SERVICES (Layer 1 — Plain API functions)

### File: `packages/shared-hooks/src/services/section.service.ts`

```typescript
export const sectionService = {
  create: (courseId: string, data: { title: string; order?: number }) =>
    apiClient.post(`/instructor/courses/${courseId}/sections`, data),

  update: (courseId: string, sectionId: string, data: { title?: string }) =>
    apiClient.patch(`/instructor/courses/${courseId}/sections/${sectionId}`, data),

  delete: (courseId: string, sectionId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/sections/${sectionId}`),

  reorder: (courseId: string, orderedIds: string[]) =>
    apiClient.put(`/instructor/courses/${courseId}/sections/reorder`, { orderedIds }),
};
```

### File: `packages/shared-hooks/src/services/chapter.service.ts`

```typescript
export const chapterService = {
  // ⚠️ ALL routes include sectionId
  create: (courseId: string, sectionId: string, data: {
    title: string; description?: string; price?: number; isFreePreview?: boolean; order?: number;
  }) => apiClient.post(
    `/instructor/courses/${courseId}/sections/${sectionId}/chapters`, data
  ),

  update: (courseId: string, sectionId: string, chapterId: string, data: {
    title?: string; description?: string; price?: number; isFreePreview?: boolean;
  }) => apiClient.patch(
    `/instructor/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`, data
  ),

  delete: (courseId: string, sectionId: string, chapterId: string) =>
    apiClient.del(
      `/instructor/courses/${courseId}/sections/${sectionId}/chapters/${chapterId}`
    ),

  reorder: (courseId: string, sectionId: string, orderedIds: string[]) =>
    apiClient.put(
      `/instructor/courses/${courseId}/sections/${sectionId}/chapters/reorder`,
      { orderedIds }
    ),
};
```

### File: `packages/shared-hooks/src/services/lesson.service.ts`

```typescript
export const lessonService = {
  // ⚠️ ALL routes include chapterId
  create: (courseId: string, chapterId: string, data: {
    title: string; type: 'VIDEO' | 'TEXT' | 'QUIZ';
    textContent?: string; videoUrl?: string; estimatedDuration?: number; order?: number;
  }) => apiClient.post(
    `/instructor/courses/${courseId}/chapters/${chapterId}/lessons`, data
  ),

  update: (courseId: string, chapterId: string, lessonId: string, data: {
    title?: string; textContent?: string; videoUrl?: string; estimatedDuration?: number;
  }) => apiClient.patch(
    `/instructor/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`, data
  ),

  delete: (courseId: string, chapterId: string, lessonId: string) =>
    apiClient.del(
      `/instructor/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`
    ),

  reorder: (courseId: string, chapterId: string, orderedIds: string[]) =>
    apiClient.put(
      `/instructor/courses/${courseId}/chapters/${chapterId}/lessons/reorder`,
      { orderedIds }
    ),
};
```

### File: `packages/shared-hooks/src/services/quiz.service.ts`

```typescript
export const quizService = {
  get: (courseId: string, lessonId: string) =>
    apiClient.get(`/instructor/courses/${courseId}/lessons/${lessonId}/quiz`),

  upsert: (courseId: string, lessonId: string, data: {
    passingScore?: number;
    maxAttempts?: number;
    timeLimitSeconds?: number;
    questions: Array<{
      question: string;
      explanation?: string;
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  }) => apiClient.put(
    `/instructor/courses/${courseId}/lessons/${lessonId}/quiz`, data
  ),

  delete: (courseId: string, lessonId: string) =>
    apiClient.del(`/instructor/courses/${courseId}/lessons/${lessonId}/quiz`),
};
```

### File: `packages/shared-hooks/src/services/upload.service.ts`

```typescript
export const uploadService = {
  sign: (data: { type: 'VIDEO' | 'IMAGE' | 'ATTACHMENT'; lessonId?: string; folder?: string }) =>
    apiClient.post<{ mediaId: string; [key: string]: unknown }>('/uploads/sign', data),

  complete: (mediaId: string, cloudinaryResult: {
    publicId: string; secureUrl: string; duration?: number;
    format: string; bytes: number; originalFilename?: string;
  }) => apiClient.post(`/uploads/${mediaId}/complete`, { cloudinaryResult }),

  delete: (mediaId: string) =>
    apiClient.del(`/uploads/${mediaId}`),
};
```

### Update: `packages/shared-hooks/src/services/index.ts`

Export all new services.

---

## 4. QUERY HOOKS (Layer 2 — TanStack Query)

### File: `packages/shared-hooks/src/queries/use-sections.ts`

```typescript
// useCreateSection, useUpdateSection, useDeleteSection, useReorderSections
// NO onSuccess invalidation — batch save handles single invalidation at end
// All toast.error on error
```

### File: `packages/shared-hooks/src/queries/use-chapters.ts`

Same pattern. ⚠️ mutations include `sectionId` param. NO `onSuccess` invalidation.

### File: `packages/shared-hooks/src/queries/use-lessons.ts`

Same pattern. ⚠️ mutations include `chapterId` param. NO `onSuccess` invalidation.

### File: `packages/shared-hooks/src/queries/use-quiz.ts`

```typescript
export function useQuiz(courseId: string, lessonId: string) {
  return useQuery({
    queryKey: ['instructor', 'courses', courseId, 'lessons', lessonId, 'quiz'],
    queryFn: () => quizService.get(courseId, lessonId),
    enabled: !!courseId && !!lessonId,
  });
}

export function useUpsertQuiz() {
  // On success: invalidate quiz query + course detail
}

export function useDeleteQuiz() {
  // On success: invalidate quiz query + course detail
}
```

### File: `packages/shared-hooks/src/queries/use-categories.ts`

```typescript
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
    staleTime: 10 * 60 * 1000, // 10 min — categories rarely change
  });
}
```

### Update: `packages/shared-hooks/src/index.ts`

Export all new hooks and services.

---

## 5. ZOD VALIDATION SCHEMAS

### File: `apps/management-portal/src/lib/validations/course.ts`

```typescript
// Step 1 — Basic Info
export const courseBasicsSchema = z.object({
  title: z.string().min(5, 'min5').max(200, 'max200'),
  shortDescription: z.string().max(200).optional().or(z.literal('')),
  description: z.string().min(50, 'min50').optional().or(z.literal('')),
  categoryId: z.string().min(1, 'required'),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  language: z.string().min(1, 'required'),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  promoVideoUrl: z.string().url().optional().or(z.literal('')), // set by VideoUpload
  learningOutcomes: z.array(z.string().min(1)).optional(),
  prerequisites: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
});

// Step 3 — Pricing
export const coursePricingSchema = z.object({
  price: z.number().int().min(0),
  isFree: z.boolean(), // UI toggle, sets price=0
});

// Section/Chapter/Lesson inline forms
export const sectionSchema = z.object({
  title: z.string().min(2).max(200),
});

export const chapterSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional().or(z.literal('')),
});

export const lessonSchema = z.object({
  title: z.string().min(2).max(200),
  type: z.enum(['VIDEO', 'TEXT', 'QUIZ']),
});

// Quiz
export const quizQuestionSchema = z.object({
  question: z.string().min(1, 'required'),
  explanation: z.string().optional().or(z.literal('')),
  options: z.array(z.object({
    text: z.string().min(1, 'required'),
    isCorrect: z.boolean(),
  })).min(2, 'min2Options'),
}).refine(
  (data) => data.options.filter((o) => o.isCorrect).length === 1,
  { message: 'exactlyOneCorrect', path: ['options'] }
);

export const quizSchema = z.object({
  passingScore: z.number().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  timeLimitSeconds: z.number().int().min(0).optional(),
  questions: z.array(quizQuestionSchema).min(1, 'min1Question'),
});
```

---

## 6. CLOUDINARY UPLOAD HELPER

### File: `apps/management-portal/src/lib/cloudinary.ts`

```typescript
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  duration?: number;     // Video only (seconds, float)
  bytes: number;
  format: string;
  original_filename: string;
  resource_type: string;
}

export async function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video' | 'raw',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  // Uses unsigned upload preset (NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)
  // XHR for progress tracking (fetch doesn't support upload progress)
  // Returns Cloudinary response
}

// For signed upload (video/attachment via backend):
export async function uploadWithSignedParams(
  file: File,
  signedParams: Record<string, unknown>,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  // Uses signed params from POST /uploads/sign
  // Uploads directly to Cloudinary
}
```

---

## 7. COMPONENT ARCHITECTURE

```
CourseWizard (container — manages step state, holds all form data)
├── WizardStepIndicator (visual step bar 1-4)
│
├── StepBasics (Step 1)
│   ├── React Hook Form + courseBasicsSchema
│   ├── <fieldset disabled={isReadOnly}> wraps all inputs
│   ├── Category select (from useCategories)
│   ├── ImageUpload (thumbnail — aspect-video 16:9)
│   ├── VideoUpload (promoVideo — replaces URL input)
│   ├── RichTextEditor (description — editable=false when readOnly)
│   ├── DynamicStringList (learningOutcomes)
│   ├── DynamicStringList (prerequisites)
│   └── TagInput (tags)
│
├── StepCurriculum (Step 2)
│   ├── LocalCurriculumState (sections → chapters → lessons in React state)
│   ├── SectionCard (collapsible)
│   │   ├── ArrowUp/ArrowDown reorder buttons (Move Up/Down)
│   │   ├── Inline editable title
│   │   ├── ChapterCard (collapsible)
│   │   │   ├── ArrowUp/ArrowDown reorder buttons
│   │   │   ├── Inline editable title
│   │   │   ├── LessonRow (icon + title + duration + type badge + actions)
│   │   │   │   └── ArrowUp/ArrowDown reorder buttons
│   │   │   └── AddLessonButton → LessonDialog
│   │   └── AddChapterButton
│   ├── AddSectionButton
│   ├── LessonDialog (key={lesson?.tempId ?? (open ? 'new' : 'closed')})
│   │   ├── Self-contained portal via ReactDOM.createPortal (z-9999)
│   │   ├── <fieldset disabled={isReadOnly}> wraps form
│   │   ├── Type selector: VIDEO | TEXT | QUIZ
│   │   ├── VIDEO → VideoUpload → stores {url, duration} in local lesson
│   │   ├── TEXT → RichTextEditor (Tiptap HTML)
│   │   └── QUIZ → QuizBuilder (onChange callback, data in quizData)
│   │       ├── Question list (add/edit/delete questions)
│   │       ├── Option list per question (add/edit/mark correct)
│   │       ├── Quiz settings (passingScore, maxAttempts, timeLimit)
│   │       └── ImportQuizDialog (z-10000, self-contained portal)
│   └── Single queryClient.invalidateQueries at end of batch save
│
├── StepPricing (Step 3)
│   ├── <fieldset disabled={isReadOnly}> wraps all inputs
│   ├── Course price input (or "Free" toggle)
│   └── Chapter pricing table (price + freePreview per chapter)
│
├── StepReview (Step 4)
│   ├── BasicInfo summary (read-only)
│   ├── Curriculum tree (read-only)
│   ├── Pricing summary (read-only)
│   ├── Completeness checklist (checkmarks)
│   └── SubmitForReview button (enabled when all checks pass)
│
└── CourseDetail page ([courseId]/page.tsx)
    ├── CourseInfoCard
    ├── CourseStats
    ├── CourseCurriculum (read-only tree)
    └── LessonDetailDialog (video player / text HTML / quiz preview)
```

---

## 8. STEP-BY-STEP COMPONENT SPECS

### 8.1 CourseWizard Container

**File:** `components/courses/wizard/course-wizard.tsx`

```typescript
interface CourseWizardProps {
  mode: 'create' | 'edit';
  courseId?: string; // Required for edit mode
}

const isReadOnly = course?.status === 'PENDING_REVIEW';

// State managed in container:
const [currentStep, setCurrentStep] = useState(1);
const [basicInfoValues, setBasicInfoValues] = useState<CourseBasicsValues | null>(null);
const [curriculumState, setCurriculumState] = useState<LocalSection[]>([]);
const [pricingValues, setPricingValues] = useState<PricingFormValues | null>(null);

// In edit mode: fetch course detail, populate initial values
const { data: course } = useInstructorCourseDetail(courseId);
```

**WizardStepIndicator:** Visual bar with 4 steps. In edit mode, all steps clickable.
In create mode, only completed steps + current step clickable.

### 8.2 StepBasics (Step 1)

**File:** `components/courses/wizard/step-basics.tsx`

- React Hook Form + zodResolver(courseBasicsSchema)
- In edit mode: `defaultValues` from course data
- `<fieldset disabled={isReadOnly}>` wraps the entire form
- Category select: `useCategories()` → flatten tree to options with indentation
- `ImageUpload`: upload thumbnail → set `thumbnailUrl` form field. Uses `aspect-video` (16:9)
- `VideoUpload`: upload promo video → set `promoVideoUrl` form field (replaces URL text input)
- `RichTextEditor` (Tiptap): for `description` field. Receives `readOnly={isReadOnly}`
- `DynamicStringList`: for `learningOutcomes` and `prerequisites`
- `TagInput`: text input with "Enter to add", badge display, remove button

**On Next/Save:**
```typescript
if (mode === 'create' && !courseId) {
  // POST /instructor/courses → get courseId
  createCourse.mutate(data, {
    onSuccess: (res) => {
      // Redirect to /courses/:id/edit?step=2
      router.replace(`/instructor/courses/${res.data.id}/edit?step=2`);
    },
  });
} else {
  // PATCH /instructor/courses/:id
  updateCourse.mutate({ courseId, data }, {
    onSuccess: () => setCurrentStep(2),
  });
}
```

### 8.3 StepCurriculum (Step 2)

**File:** `components/courses/wizard/step-curriculum.tsx`

**Local state initialization:**
```typescript
// On mount or when course data changes:
// Convert server sections → LocalSection[]
useEffect(() => {
  if (course?.sections && curriculumState.length === 0) {
    setCurriculumState(
      course.sections.map((s) => ({
        id: s.id,
        tempId: s.id,
        title: s.title,
        order: s.order,
        chapters: s.chapters.map((ch) => ({
          id: ch.id,
          tempId: ch.id,
          title: ch.title,
          order: ch.order,
          sectionId: s.id,
          lessons: ch.lessons.map((l) => ({
            id: l.id,
            tempId: l.id,
            title: l.title,
            type: l.type,
            textContent: l.textContent,
            videoUrl: l.videoUrl,
            estimatedDuration: l.estimatedDuration,
            chapterId: ch.id,
          })),
        })),
      }))
    );
  }
}, [course]);
```

**Local CRUD operations (no API calls):**
- addSection() → push new LocalSection with `isNew: true`
- renameSection(tempId, title) → update title, set `isModified: true`
- deleteSection(tempId) → set `isDeleted: true` (or remove if `isNew`)
- Similar for chapters and lessons
- moveUp/moveDown: swap order values in local array (ArrowUp/ArrowDown buttons)

**Reorder — Move Up/Down buttons (NOT drag and drop):**
ArrowUp and ArrowDown icon buttons on each Section, Chapter, and Lesson row.
Click updates position in local state. Order persisted to server during batch save.

**Batch save on Next:**
```typescript
async function saveCurriculum() {
  // 1. Delete: sections/chapters/lessons marked isDeleted (from server state)
  // 2. Create: sections/chapters/lessons marked isNew
  //    - For QUIZ lessons: after lessonId returned, save quizData via quiz.upsert()
  // 3. Update: sections/chapters/lessons marked isModified
  // 4. Reorder: if order changed
  // Order matters: delete first, then create, then update, then reorder
  // Each step awaited sequentially

  // Single invalidation AFTER all mutations:
  queryClient.invalidateQueries({ queryKey: ['instructor', 'courses', courseId] });
}
```

### 8.4 LessonDialog

**File:** `components/courses/wizard/lesson-dialog.tsx`

**Key-based remount:** `key={lesson?.tempId ?? (open ? 'new' : 'closed')}`
Ensures React completely unmounts/remounts the dialog when switching between lessons,
preventing quiz state from leaking from one lesson into another.

**Portal rendering:**
```typescript
import * as ReactDOM from 'react-dom';

if (!open) return null;
return ReactDOM.createPortal(
  <div className="fixed inset-0 z-[9999] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className="relative z-10 ...panel styles...">{children}</div>
  </div>,
  document.body,
);
```

**VIDEO tab:**
- File input (accept: video/*)
- Upload to Cloudinary with progress bar
- After upload: `<video>` player preview with controls (`aspect-video`)
- Auto-fill `estimatedDuration` from Cloudinary `duration` field
- Stores `{ url, duration }` in local lesson state (no Media table)

**TEXT tab:**
- Title input
- `RichTextEditor` (Tiptap) with 3 tabs: **Edit** (WYSIWYG), **Preview** (rendered HTML),
  **HTML** (raw source). `@tailwindcss/typography` plugin for `prose` classes in Preview tab.
- `readOnly` prop hides toolbar and sets `editable: false`

**QUIZ tab:**
- Title input
- `QuizBuilder` component — does NOT self-save
  - Exposes data via `onChange: (data: QuizFormValues) => void` callback
  - Data buffered in `LocalLesson.quizData`
  - Saved to server AFTER lesson is created (requires `lessonId`)

### 8.5 QuizBuilder

**File:** `components/courses/wizard/quiz-builder.tsx`

**Props:**
```typescript
interface QuizBuilderProps {
  value?: QuizFormValues;
  onChange: (data: QuizFormValues) => void;
  readOnly?: boolean;
}
```

**UI structure:**
```
Quiz Settings
├── Passing Score: [70] % (number input)
├── Max Attempts: [3] (number input, optional)
└── Time Limit: [0] seconds (number input, optional, 0=unlimited)

Questions
├── Question 1: [What is React?] [Delete]
│   ├── ○ [A library] [✓ Correct] [Delete]
│   ├── ○ [A framework] [Delete]
│   ├── ○ [A language] [Delete]
│   ├── + Add Option
│   └── Explanation: [React is a JS library...]
├── Question 2: ...
├── + Add Question
└── [Import from Text] button
```

**State:** `useFieldArray` for questions, nested `useFieldArray` for options.
Validation: each question must have exactly 1 correct option.
Calls `onChange` after every change so parent holds latest data.

**Import from text (ImportQuizDialog):**
- Renders via self-contained portal at `z-[10000]` (above LessonDialog `z-[9999]`)
- Parse format: numbered questions, lettered options, asterisk marks correct, `Explanation:` line

### 8.6 RichTextEditor

**File:** `apps/management-portal/src/components/courses/rich-text-editor.tsx`

```typescript
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}
```

**3 tabs:**
1. **Edit** — Tiptap WYSIWYG editor. Toolbar: Bold, Italic, H2, H3, BulletList,
   OrderedList, Link, Undo, Redo. Hidden when `readOnly`.
2. **Preview** — Renders HTML via `dangerouslySetInnerHTML`. `prose dark:prose-invert`
   classes from `@tailwindcss/typography`.
3. **HTML** — Raw `<textarea>` showing/editing the HTML source.

When `readOnly=true`: `editable: false` on Tiptap editor, toolbar hidden,
tab bar still visible (for Preview/HTML inspection).

Must set `immediatelyRender: false` for SSR compatibility.

### 8.7 StepPricing (Step 3)

**File:** `components/courses/wizard/step-pricing.tsx`

**Course-level:**
- `<fieldset disabled={isReadOnly}>` wraps the form
- "Free Course" toggle → sets price to 0
- Price input (number, VND) — disabled when free
- Display formatted price

**Chapter-level table:**
- Load chapters from course detail (or from curriculum state)
- For each chapter: price input + "Free Preview" toggle
- Only send PATCH for chapters whose pricing actually changed

**On Next:**
```typescript
// 1. PATCH course price
await updateCourse.mutateAsync({ courseId, data: { price } });

// 2. PATCH changed chapters (only those that differ from server)
for (const ch of changedChapters) {
  await updateChapter.mutateAsync({
    courseId, sectionId: ch.sectionId, chapterId: ch.id,
    data: { price: ch.price, isFreePreview: ch.isFreePreview },
  });
}
```

### 8.8 StepReview (Step 4)

**File:** `components/courses/wizard/step-review.tsx`

**Read-only preview:**
- Basic info card (title, category, level, language, price, thumbnail)
- Curriculum tree (sections → chapters → lessons with type icons)
- Pricing summary
- Learning outcomes / prerequisites lists

**Completeness checklist (mirrors backend `validateCourseCompleteness`):**
```typescript
const checks = [
  { key: 'title', pass: !!course.title },
  { key: 'description', pass: !!course.description && course.description.length >= 50 },
  { key: 'category', pass: !!course.categoryId },
  { key: 'sections', pass: course.sections.length > 0 },
  { key: 'chapters', pass: course.sections.some(s => s.chapters.length > 0) },
  { key: 'lessons', pass: hasAtLeastOneLesson },
];
const allPassed = checks.every(c => c.pass);
```

**Submit button:** Enabled only when `allPassed`. Calls `POST /courses/:id/submit`.
On success → toast + redirect to courses list.
Hidden when `isReadOnly` (PENDING_REVIEW status).

### 8.9 Course Detail Page

**File:** `apps/management-portal/src/app/[locale]/instructor/courses/[courseId]/page.tsx`

New page accessible at `/instructor/courses/:courseId` (without `/edit`).
Shows a read-only view of the course for the instructor.

**Components (under `components/courses/detail/`):**

**`CourseInfoCard`** — Displays title, thumbnail, status badge, category, level,
language, price, description (rendered HTML), learning outcomes, prerequisites, tags.

**`CourseStats`** — Shows totalStudents, totalLessons, avgRating, reviewCount.
Filters `courseStats` from dashboard to `status: 'PUBLISHED'` only.

**`CourseCurriculum`** — Read-only accordion tree of sections → chapters → lessons.
Each lesson row has an info button that opens `LessonDetailDialog`.

**`LessonDetailDialog`** — Shows lesson content based on type:
- `VIDEO` → `<video>` player with controls
- `TEXT` → rendered HTML with `prose dark:prose-invert`
- `QUIZ` → quiz question list (read-only preview)

### 8.10 ImageUpload

**File:** `apps/management-portal/src/components/courses/image-upload.tsx`

```typescript
interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
}
```

- No value: dropzone (click or drag) using `aspect-video` (16:9) layout
- Uploading: progress bar (percent)
- Has value: image preview + "Change" / "Remove" buttons
- Uses `uploadToCloudinary(file, 'image', setProgress)`
- Max file size: 25MB (up from original 10MB)

### 8.11 VideoUpload

**File:** `apps/management-portal/src/components/courses/video-upload.tsx`

```typescript
interface VideoUploadProps {
  value?: { url: string; duration: number };
  onChange: (result: { url: string; duration: number; mediaId?: string }) => void;
  courseId: string;
}
```

- Upload flow: sign → Cloudinary upload → complete → return result
- Shows progress bar during upload
- After upload: `<video>` player preview using `aspect-video` (16:9) + `max-w-md`
- Duration auto-extracted from Cloudinary response

---

## 9. BREADCRUMB DYNAMIC TITLE

**File:** `apps/management-portal/src/components/navigation/breadcrumb.tsx`

`CourseTitle` sub-component fetches course title via `useInstructorCourseDetail()`.
Already cached by TanStack Query — no extra network request in most cases.
CUID segments auto-detected by regex `/^c[0-9a-z]{24}$/i`.

i18n keys added: `nav.new`, `nav.edit`, `nav.curriculum`, `nav.students` (for future pages).
Display rule:
- `/courses/new` → translated "New Course"
- `/courses/:courseId/edit` → `<CourseTitle id={courseId}> / Edit`
- `/courses/:courseId` → `<CourseTitle id={courseId}>`

---

## 10. BACKEND ERROR CODE LOCALIZATION

Added ~80 backend error codes to both `vi.json` and `en.json` under `apiErrors` namespace.

Examples:
- `COURSE_NOT_FOUND`, `COURSE_ALREADY_PUBLISHED`, `COURSE_NOT_OWNED`
- `SECTION_NOT_FOUND`, `CHAPTER_NOT_FOUND`, `LESSON_NOT_FOUND`
- `QUIZ_NOT_FOUND`, `QUIZ_ALREADY_EXISTS`
- `UPLOAD_NOT_FOUND`, `UPLOAD_ALREADY_COMPLETED`
- `CATEGORY_NOT_FOUND`, `INVALID_COURSE_STATUS`

---

## 11. DEPENDENCIES

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/pm \
  @tailwindcss/typography \
  -w apps/management-portal
```

No other new dependencies:
- Cloudinary upload: native XHR (progress support)
- Reorder: ArrowUp/ArrowDown buttons (no DnD library needed)
- Forms: react-hook-form + zod (already installed)

---

## 12. I18N KEYS

### Namespaces added to both `vi.json` and `en.json`:

**`courseWizard`** key groups:
- **Wizard:** createTitle, editTitle, step1-4 labels, next, previous, saveDraft, savedSuccess
- **Step 1:** title, shortDescription, description, category, level, language, thumbnail,
  promoVideo, learningOutcomes, prerequisites, tags, addItem, selectCategory, selectLevel
- **Step 2:** addSection, addChapter, addLesson, editLesson, newSection, newChapter,
  deleteConfirm, deleteWarning, lessonType, videoUpload, textContent, quizBuilder,
  section, chapter, lesson, lessons, noSections, noChapters, noLessons,
  uploadVideo, uploadingVideo, videoPreview, importQuiz, importQuizDesc,
  importQuizPlaceholder, parseError, lessonTitleRequired, moveUp, moveDown
- **Quiz:** question, addQuestion, addOption, explanation, correctAnswer,
  passingScore, maxAttempts, timeLimit, timeLimitHelp, importFromText,
  optionPlaceholder, questionPlaceholder, noQuestions
- **Step 3:** coursePrice, freeCourse, chapterPricing, freePreview, priceVnd, noChaptersYet
- **Step 4:** reviewTitle, checklist, checkTitle, checkDescription, checkCategory,
  checkSections, checkChapters, checkLessons, submitForReview, allChecksMustPass,
  courseSubmitted, basicInfoSummary, curriculumSummary, pricingSummary, pendingReviewNote
- **RichTextEditor tabs:** tabEdit, tabPreview, tabHtml

**`apiErrors`** namespace (~80 backend error codes)

**`nav`** additions: `new`, `edit`, `curriculum`, `students`

---

## 13. FILES SUMMARY

### New files (packages/shared-hooks):

| File | Purpose |
|------|---------|
| `services/section.service.ts` | Section API functions |
| `services/chapter.service.ts` | Chapter API functions |
| `services/lesson.service.ts` | Lesson API functions (includes videoUrl) |
| `services/quiz.service.ts` | Quiz API functions |
| `services/upload.service.ts` | Upload sign/complete/delete |
| `queries/use-sections.ts` | Section mutations (no onSuccess invalidation) |
| `queries/use-chapters.ts` | Chapter mutations (no onSuccess invalidation) |
| `queries/use-lessons.ts` | Lesson mutations (no onSuccess invalidation) |
| `queries/use-quiz.ts` | Quiz query + upsert/delete mutations |
| `queries/use-categories.ts` | Categories list query |

### New files (apps/management-portal):

| File | Purpose |
|------|---------|
| `lib/validations/course.ts` | Zod schemas for all wizard steps + quiz |
| `lib/cloudinary.ts` | Upload helpers (XHR for progress) |
| `components/courses/wizard/course-wizard.tsx` | Wizard container, step state |
| `components/courses/wizard/step-basics.tsx` | Step 1 form with readOnly support |
| `components/courses/wizard/step-curriculum.tsx` | Step 2 with batch save + single invalidation |
| `components/courses/wizard/step-pricing.tsx` | Step 3 pricing with readOnly support |
| `components/courses/wizard/step-review.tsx` | Step 4 review + submit |
| `components/courses/wizard/lesson-dialog.tsx` | Self-contained portal, key remount |
| `components/courses/wizard/quiz-builder.tsx` | onChange-based, no self-save |
| `components/courses/wizard/import-quiz-dialog.tsx` | Self-contained portal z-10000 |
| `components/courses/rich-text-editor.tsx` | Tiptap + 3 tabs (Edit/Preview/HTML) |
| `components/courses/image-upload.tsx` | Cloudinary image dropzone, aspect-video |
| `components/courses/video-upload.tsx` | Cloudinary video upload + preview |
| `components/courses/detail/course-info-card.tsx` | Course detail info display |
| `components/courses/detail/course-stats.tsx` | Stats (PUBLISHED filter) |
| `components/courses/detail/course-curriculum.tsx` | Read-only curriculum tree |
| `components/courses/detail/lesson-detail-dialog.tsx` | Video/text/quiz preview |
| `app/[locale]/instructor/courses/[courseId]/page.tsx` | NEW: Course detail page |

### Modified files:

| File | Changes |
|------|---------|
| `courses/new/page.tsx` | Rewrite → `<CourseWizard mode="create" />` |
| `courses/[courseId]/edit/page.tsx` | Rewrite → `<CourseWizard mode="edit" />` |
| `shared-hooks/src/services/index.ts` | + export new services |
| `shared-hooks/src/index.ts` | + export new hooks |
| `messages/vi.json` | + courseWizard, apiErrors (~80 codes), nav additions |
| `messages/en.json` | + courseWizard, apiErrors (~80 codes), nav additions |
| `components/navigation/breadcrumb.tsx` | CourseTitle component, CUID detection |
| `components/feedback/confirm-dialog.tsx` | Uses shared Dialog (with portal) |
| `packages/shared-ui/src/components/dialog.tsx` | createPortal added |

### Backend modified files:

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | + `videoUrl String?` on Lesson model |
| `prisma/migrations/20260321000000_add_lesson_video_url/` | Migration file |
| `modules/courses/sections/sections.controller.ts` | + `@SkipThrottle()` + `@Public()` on GET |
| `modules/courses/chapters/chapters.controller.ts` | + `@SkipThrottle()` + `@Public()` on GET |
| `modules/courses/lessons/lessons.controller.ts` | + `@SkipThrottle()` + `@Public()` on GET |
| `modules/courses/lessons/dto/create-lesson.dto.ts` | + `videoUrl?: string` |
| `modules/courses/lessons/dto/update-lesson.dto.ts` | + `videoUrl?: string` |

---

## 14. BUG FIXES

### 14.1 HTTP 429 — Too Many Requests During Batch Save

**Root cause:** Each mutation hook called `queryClient.invalidateQueries` in `onSuccess`.
Batch save for a course with 3 sections + 5 chapters + 10 lessons = 18 sequential
invalidations → 18 rapid re-fetches → backend ThrottlerModule blocks at 3 req/s.

**Fix:** Removed `onSuccess` from all section/chapter/lesson mutation hooks.
Batch save calls `queryClient.invalidateQueries` exactly **once** at the end.

**Impact:** No `@SkipThrottle()` needed — the problem was excessive re-fetches, not the
mutations themselves. However, `@SkipThrottle()` was also added to these controllers
as a defense-in-depth measure (batch operations by authenticated instructors).

### 14.2 Dialog Portal — Wrong Position Under CSS Transform

**Root cause:** Parent layout has CSS `transform` (sidebar transition animation).
`position: fixed` elements create a new containing block under CSS `transform`,
so the overlay renders relative to the sidebar instead of the viewport.

**Fix:** `LessonDialog` and `ImportQuizDialog` use self-contained portal pattern —
render directly via `ReactDOM.createPortal(content, document.body)` bypassing
the shared Dialog component. Z-index stacking: LessonDialog `z-[9999]`,
ImportQuizDialog `z-[10000]`.

The shared `Dialog` component (`packages/shared-ui`) was also updated to use
`createPortal`, which works for `ConfirmDialog` (parent has no transform).

### 14.3 Quiz State Leak Between Lessons

**Root cause:** `LessonDialog` is a single component instance — when editing lesson A
then opening lesson B, React re-uses the component instance. `QuizBuilder` internal
state (useFieldArray) retained lesson A's questions.

**Fix:** `key={lesson?.tempId ?? (open ? 'new' : 'closed')}` on `LessonDialog`.
Different key value forces React to unmount + remount, creating fresh state.

### 14.4 Video URL Not Persisted

**Root cause:** Original plan used Media table (via `POST /uploads/sign` + `POST /uploads/:id/complete`).
This adds complexity: lesson creation required a separate media record, and the
`videoUrl` had to be fetched via join.

**Fix:** Added `videoUrl String?` directly to Lesson model in Prisma schema.
Prisma migration `20260321000000_add_lesson_video_url` applied.
DTOs updated. `VideoUpload` component now stores URL directly in local lesson state,
batch save sends `videoUrl` in the create/update payload.

### 14.5 Quiz Save Ordering Problem

**Root cause:** `QuizBuilder` was designed to call `PUT /lessons/:lessonId/quiz` directly.
But for **new** lessons, `lessonId` does not exist until the lesson is created via POST.
Self-saving quiz before lesson creation → 404 error.

**Fix:** QuizBuilder changed to a controlled component (no internal API calls).
Data flows via `onChange` callback → stored in `LocalLesson.quizData`.
Batch save creates the lesson first → receives `lessonId` → saves quiz data in the same
transaction.

### 14.6 Promo Video URL Input

**Problem:** Step 1 had a plain `<Input>` for `promoVideoUrl`. Inconsistent UX — all
other media fields use upload components.

**Fix:** Replaced with `<VideoUpload>` component. Same Cloudinary upload flow as lesson
videos. `promoVideoUrl` form field set to `secureUrl` from upload result.

### 14.7 Aspect Ratio Inconsistency

**Problem:** Thumbnail and video previews had inconsistent sizes (`h-48`, `h-56`).

**Fix:** All image/video containers use `aspect-video` (16:9) + `max-w-md`.
Dropzone area also uses `aspect-video` instead of fixed pixel height.
Image max file size increased: 10MB → 25MB.

---

## 15. IMPLEMENTATION ORDER (ACTUAL)

```
1. Backend: Add videoUrl to Lesson model + migration + update DTOs
2. Backend: Add @SkipThrottle() + @Public() to sections/chapters/lessons controllers
3. Services: section, chapter, lesson (with videoUrl), quiz, upload
4. Query hooks: use-sections, use-chapters, use-lessons (no onSuccess), use-quiz, use-categories
5. Zod schemas (course.ts) + Cloudinary helper (cloudinary.ts)
6. RichTextEditor (3 tabs: Edit/Preview/HTML + @tailwindcss/typography)
7. ImageUpload (aspect-video) + VideoUpload (aspect-video)
8. CourseWizard container + WizardStepIndicator
9. StepBasics (with readOnly + VideoUpload for promoVideo)
10. QuizBuilder (controlled, onChange-based) + ImportQuizDialog (portal z-10000)
11. LessonDialog (portal, key remount, fieldset readOnly)
12. StepCurriculum (move up/down, batch save, single invalidation)
13. StepPricing (with readOnly)
14. StepReview (with PENDING_REVIEW state)
15. Course detail page + detail components
16. Breadcrumb CourseTitle component
17. i18n keys (courseWizard + apiErrors ~80 codes + nav additions)
18. Lint + build + verify
```

---

## 16. VERIFICATION CHECKLIST

- [x] Create mode: Step 1 creates DRAFT → redirect to `/courses/:id/edit?step=2`
- [x] Edit mode: loads existing data, pre-fills all steps
- [x] Step indicator shows progress, clickable in edit mode
- [x] Back/Next navigation preserves state between steps
- [x] PENDING_REVIEW: all inputs disabled, save buttons hidden
- [x] Category dropdown loads from API, shows nested structure
- [x] Image upload: dropzone → Cloudinary → aspect-video 16:9 preview → URL in form
- [x] Promo video: VideoUpload component (not URL input)
- [x] Tiptap editor: Edit/Preview/HTML tabs, bold/italic/headings/lists/links
- [x] Dynamic lists (outcomes/prerequisites) add/remove work
- [x] Section CRUD + ArrowUp/ArrowDown reorder
- [x] Chapter CRUD + ArrowUp/ArrowDown reorder
- [x] Lesson dialog: VIDEO/TEXT/QUIZ type tabs work
- [x] Video upload: progress bar → aspect-video preview → duration extracted → stored as videoUrl
- [x] Text lesson: Tiptap editor saves HTML, Preview tab renders prose
- [x] Quiz builder: add/edit/delete questions + options, onChange callback
- [x] Quiz validation: exactly 1 correct answer per question
- [x] Import quiz from text format works (z-10000 portal)
- [x] Quiz data saved AFTER lesson created (no 404)
- [x] LessonDialog key remount prevents quiz state leak
- [x] Batch save: single queryClient.invalidateQueries at end (no 429)
- [x] Pricing: course price + chapter prices + free preview toggle
- [x] Review: completeness checklist matches backend validation
- [x] Submit: enabled only when all checks pass
- [x] Course detail page: CourseInfoCard, CourseStats, CourseCurriculum, LessonDetailDialog
- [x] Breadcrumb shows course title (not CUID), edit/new localized
- [x] ~80 backend error codes localized in vi.json + en.json
- [x] All text uses `useTranslations('courseWizard')`
- [x] Dark mode correct on all components
- [x] Dialog renders as portal overlay (not inline, not affected by transform)
- [x] No imports from mock-data.ts
- [x] Build passes with no errors

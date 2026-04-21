# Sub-phase 5.13d — LEARNING

> My Learning dashboard, Course Player (video + text + quiz), Certificates.
> Dependency: 5.13c (Ecommerce — enrollment flow) ✅ done.

---

## Hiện trạng

### Đã có sẵn:
- **3 pages** mock UI: My Learning (`my-learning/page.tsx`), Lesson Player (`(learning)/courses/[slug]/lessons/[lessonId]/page.tsx`), Certificates (`my-learning/certificates/page.tsx`)
- **Learning layout** (`(learning)/layout.tsx`): minimal header với back button, progress bar — hardcoded "React & Next.js", "65%"
- **LearningSidebar** component: curriculum accordion, tabs (curriculum/notes/aiTutor/resources)
- **Enrollment hooks**: `useMyLearning`, `useEnrollmentCheck`, `useEnrollFree` đã có
- **i18n**: `myLearning`, `learning`, `certificates` namespace đã có keys cơ bản
- **Shared types**: `LessonProgress`, `Certificate`, `LessonType` (VIDEO/TEXT/QUIZ)

### Backend API endpoints:

**Course Player** (require auth):
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/courses/:courseId/learn/:lessonId` | `{ lesson, curriculum }` |

**Lesson response:**
```
lesson: {
  id, title, type, textContent, estimatedDuration,
  videoUrl,
  media: [{ url, type }],
  attachments: [{ url, name }],
  quiz: {
    id, title, passingScore, maxAttempts,
    questions: [{ id, text, type, order,
      options: [{ id, text, order }]  // NO isCorrect!
    }]
  },
  isCompleted: boolean,
  progress: { lastPosition, watchedPercent, watchedSegments } | null
}
curriculum: [sections > chapters > lessons with isCompleted]
```

**Access control (3-tier):**
1. Free preview chapter → luôn cho xem
2. FULL enrollment → xem tất cả
3. Chapter purchase → chỉ xem chapter đã mua

**Progress** (require auth):
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| PUT | `/learning/progress/:lessonId` | `{ lastPosition?, watchedSegments? }` | Updated progress |
| POST | `/learning/lessons/:lessonId/complete` | — | Completion status |
| GET | `/learning/progress/:courseId` | — | Course progress + per-lesson status |

**Quiz Attempts** (require auth):
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/learning/lessons/:lessonId/quiz/submit` | `{ answers: [{ questionId, selectedOptionId }] }` | `{ score, passed, results, courseProgress }` |
| GET | `/learning/lessons/:lessonId/quiz/attempts` | — | Attempt history |

**Quiz submit response:**
```
{
  attemptId, score (0-100), correctCount, totalQuestions, passed,
  results: [{
    questionId, questionText, selectedOptionId,
    correctOptionId, isCorrect, explanation
  }],
  courseProgress: number (0-1)
}
```

**Streaks & Dashboard** (require auth):
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/learning/dashboard` | `{ activeCourses, completedCourses, streak }` |
| GET | `/learning/streak` | `{ currentStreak, longestStreak, todayCompleted }` |

**Dashboard response (activeCourses — enrollment fields spread):**
```
{
  id, progress, courseId,  // enrollment spread (NOT nested)
  course: { id, title, slug, thumbnailUrl, totalLessons, instructor },
  nextLesson: { id, title, type } | null
}
```

**Dashboard response (completedCourses):**
```
{
  id, progress, courseId,
  course: { id, title, slug, thumbnailUrl },
  firstLesson: { id, title, type } | null,  // for "Review" button
  certificate: { id, verifyCode } | null
}
```

**Certificates** (auth + public verify):
| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/certificates/my` | List of certificates |
| GET | `/certificates/verify/:code` | Public verify info |

**Certificate auto-generation:** Khi progress = 100% + FULL enrollment → backend tự tạo certificate.

---

## Scope & File Mapping

### Shared Hooks Layer
| # | File | Action |
|---|------|--------|
| 1 | `services/learning.service.ts` | **Create**: getLesson, updateProgress, completeLesson, getCourseProgress, submitQuiz, getQuizAttempts, getDashboard, getStreak |
| 2 | `services/certificate.service.ts` | **Create**: getMy, verify |
| 3 | `services/index.ts` | Update: export 2 new services |
| 4 | `queries/use-learning.ts` | **Create**: useLesson, useUpdateProgress, useCompleteLesson, useCourseProgress, useSubmitQuiz, useQuizAttempts, useLearningDashboard, useStreak |
| 5 | `queries/use-certificates.ts` | **Create**: useMyCertificates |
| 6 | `index.ts` | Update: export all new hooks + services |

### My Learning Page
| # | File | Action |
|---|------|--------|
| 7 | `(main)/my-learning/page.tsx` | Rewrite: API dashboard, streak info, "Continue"/"Review" buttons, enrollment spread type |

### Learning Layout + Player (tách 5 components)
| # | File | Action |
|---|------|--------|
| 8 | `(learning)/layout.tsx` | Rewrite: minimal header với `#learning-header-slot` cho portal |
| 9 | `(learning)/courses/[slug]/lessons/[lessonId]/page.tsx` | Rewrite: slug→courseId resolution, lesson by type, error handling (403), mobile sidebar |
| 10 | `components/learning/video-player.tsx` | **Create**: HTML5 video, segment tracking, onSeeking flush, 10s interval |
| 11 | `components/learning/text-viewer.tsx` | **Create**: HTML content (prose), mark complete button |
| 12 | `components/learning/quiz-player.tsx` | **Create**: 4 states (READY/TAKING/SUBMITTED/HISTORY), match API response shape |
| 13 | `components/learning/curriculum-sidebar.tsx` | **Create**: sections accordion, current lesson highlight, completion ✅ |
| 14 | `components/learning/lesson-nav.tsx` | **Create**: prev/next from flattened curriculum |

### Certificates
| # | File | Action |
|---|------|--------|
| 15 | `(main)/my-learning/certificates/page.tsx` | Rewrite: certificates từ API, share verify link |

### Backend Fixes
| # | File | Action |
|---|------|--------|
| 16 | `course-player.service.ts` | Fix: thêm `videoUrl` vào lesson response |
| 17 | `quiz-attempts.service.ts` | Fix: normalize `passingScore` (decimal vs percentage) |
| 18 | `quizzes.service.ts` | Fix: bỏ double `/100` conversion khi save |
| 19 | `streaks.service.ts` | Update: trả `firstLesson` cho completed courses (Review button) |

### i18n
| # | File | Action |
|---|------|--------|
| 20 | `messages/vi.json` | Update: ~30 new keys (quiz, video, streak, access denied) |
| 21 | `messages/en.json` | Update: ~30 new keys |

---

## Step 1 — Service Layer

### 1.1 `learning.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const learningService = {
  // Course Player
  getLesson: (courseId: string, lessonId: string) =>
    apiClient.get(`/courses/${courseId}/learn/${lessonId}`),

  // Progress
  updateProgress: (lessonId: string, data: { lastPosition?: number; watchedSegments?: [number, number][] }) =>
    apiClient.put(`/learning/progress/${lessonId}`, data),

  completeLesson: (lessonId: string) =>
    apiClient.post(`/learning/lessons/${lessonId}/complete`),

  getCourseProgress: (courseId: string) =>
    apiClient.get(`/learning/progress/${courseId}`),

  // Quiz
  submitQuiz: (lessonId: string, answers: Array<{ questionId: string; selectedOptionId: string }>) =>
    apiClient.post(`/learning/lessons/${lessonId}/quiz/submit`, { answers }),

  getQuizAttempts: (lessonId: string) =>
    apiClient.get(`/learning/lessons/${lessonId}/quiz/attempts`),

  // Dashboard & Streak
  getDashboard: () => apiClient.get('/learning/dashboard'),

  getStreak: () => apiClient.get('/learning/streak'),
};
```

### 1.2 `certificate.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export const certificateService = {
  getMy: () => apiClient.get('/certificates/my'),
  verify: (code: string) => apiClient.get(`/certificates/verify/${code}`),
};
```

---

## Step 2 — Query Hooks

### 2.1 `use-learning.ts`

```typescript
// useLesson(courseId, lessonId) — GET /courses/:courseId/learn/:lessonId
// useUpdateProgress() — mutation PUT /learning/progress/:lessonId (no invalidation, fire-and-forget)
// useCompleteLesson() — mutation POST → invalidate lesson + course progress
// useCourseProgress(courseId) — GET /learning/progress/:courseId
// useSubmitQuiz() — mutation POST → invalidate lesson + progress
// useQuizAttempts(lessonId) — GET quiz attempts history
// useLearningDashboard() — GET /learning/dashboard
// useStreak() — GET /learning/streak
```

### 2.2 `use-certificates.ts`

```typescript
// useMyCertificates() — GET /certificates/my
```

---

## Step 3 — My Learning Dashboard

### Thay đổi chính:
- Replace `mockEnrolledCourses`, `learningStats`, `streakData` → `useLearningDashboard()`
- Stats cards: từ dashboard response (activeCourses.length, completedCourses.length, streak)
- Streak calendar: từ API hoặc đơn giản hóa thành text (`currentStreak` days)
- Course cards: thumbnail, title, instructor, progress bar
- "Tiếp tục học" button → `/courses/${slug}/lessons/${nextLesson.id}` (link tới learning layout)
- Tabs: "Đang học" (progress < 100%) / "Hoàn thành" (progress >= 100%)
- Bỏ phần "Skills Map" (mock data, không có API)

### Data flow:
```typescript
const { data: dashboard } = useLearningDashboard();
// dashboard.data = {
//   activeCourses: [{ enrollment, course, nextLesson }],
//   completedCourses: [{ enrollment, course, certificate }],
//   streak: { currentStreak, longestStreak, todayCompleted }
// }
```

---

## Step 4 — Learning Layout

### Thay đổi chính:
- Layout cần biết `courseId` từ URL slug → dùng context hoặc pass via children
- Hiển thị course title + overall progress (từ URL params hoặc shared state)
- Vì layout không access lesson data trực tiếp → giữ simple: chỉ back button + slot cho title

### Lưu ý:
Next.js App Router — layout không re-render khi navigate giữa lessons cùng course. Layout chỉ cần hiển thị back button, course title sẽ set bởi lesson page thông qua document.title hoặc context.

---

## Step 5 — Lesson Player Page (phức tạp nhất)

### URL: `/(learning)/courses/[slug]/lessons/[lessonId]`

### Resolve `courseId` từ `slug`:
Backend endpoint `GET /courses/:courseId/learn/:lessonId` cần `courseId` (CUID), không phải slug.

**Giải pháp:** Giữ URL slug đẹp, dùng `useCourseDetail(slug)` (đã có từ 5.13b, cached) để resolve `courseId`:
```typescript
const { slug } = use(params);
const { data: courseData } = useCourseDetail(slug); // cached, không fetch lại
const courseId = (courseData?.data as { id: string })?.id;
const { data: lessonData } = useLesson(courseId ?? '', lessonId); // enabled: !!courseId
```
- URL giữ đẹp: `/courses/reactjs-mmxomd2o/lessons/abc123`
- Không cần sửa backend
- TanStack Query cache nên chỉ fetch course 1 lần

### Page structure:
```
┌───────────────────────────────────────────────────────────┐
│ Header: [← My Learning] [Course Title] [Progress %]      │
├─────────────────────────┬─────────────────────────────────┤
│ Main content            │ Curriculum Sidebar              │
│                         │                                 │
│ VIDEO → VideoPlayer     │ Section 1                       │
│ TEXT  → TextViewer      │   ✅ Chapter 1                  │
│ QUIZ  → QuizPlayer     │     ✅ Lesson 1                 │
│                         │     ▶ Lesson 2 (current)        │
│ [← Prev] [Next →]      │     □ Lesson 3                  │
│                         │   □ Chapter 2                   │
└─────────────────────────┴─────────────────────────────────┘
```

### Render by lesson type:
```typescript
switch (lesson.type) {
  case 'VIDEO': return <VideoPlayer lesson={lesson} onProgress={...} />;
  case 'TEXT':  return <TextViewer lesson={lesson} onComplete={...} />;
  case 'QUIZ':  return <QuizPlayer lesson={lesson} onSubmit={...} />;
}
```

---

## Step 6 — VideoPlayer Component

### Props:
```typescript
interface VideoPlayerProps {
  videoUrl: string;
  lastPosition: number;    // resume from
  onProgressUpdate: (data: { lastPosition: number; watchedSegments: [number, number][] }) => void;
}
```

### Implementation:
- HTML5 `<video>` tag với Cloudinary URL (không cần Video.js cho MVP)
- Resume: set `currentTime = lastPosition` on load
- Track segments: mỗi 10 giây gửi `{ lastPosition, watchedSegments }` qua debounced mutation
- Auto-complete: khi `watchedPercent >= 80%` (backend tính từ segments)
- Controls: play/pause, seek, fullscreen, volume

### Segment tracking:
```typescript
// Mỗi khi video play, track segment [startTime, currentTime]
// Khi pause hoặc seek: flush segment
// Gửi lên server mỗi 10 giây (debounced)
const segmentRef = useRef<{ start: number; segments: [number, number][] }>({
  start: 0, segments: []
});

const handleTimeUpdate = () => {
  const current = videoRef.current.currentTime;
  // Update current segment end
};

const handlePause = () => {
  // Flush current segment to segments array
  // Send to server
};
```

---

## Step 7 — TextViewer Component

### Props:
```typescript
interface TextViewerProps {
  textContent: string;     // HTML from Tiptap
  isCompleted: boolean;
  onComplete: () => void;
}
```

### Implementation:
- Render HTML với `dangerouslySetInnerHTML` + `prose` classes
- Nút "Đánh dấu hoàn thành" → `POST /learning/lessons/:lessonId/complete`
- Nếu đã completed → hiển thị badge ✅, nút disabled

---

## Step 8 — QuizPlayer Component (phức tạp)

### Props:
```typescript
interface QuizPlayerProps {
  quiz: {
    id: string;
    title: string;
    passingScore: number;
    maxAttempts: number;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options: Array<{ id: string; text: string }>;
    }>;
  };
  lessonId: string;
  isCompleted: boolean;
}
```

### States:
```
READY → TAKING → SUBMITTED (show results)
                ↓
         REVIEW (xem lại attempts cũ)
```

### Implementation:
1. **READY state:** Hiển thị quiz info (title, passing score, max attempts, số lần đã thử) + nút "Bắt đầu làm bài"
2. **TAKING state:**
   - Render từng câu hỏi với radio buttons (single choice)
   - Track selected answers: `Record<questionId, optionId>`
   - Progress indicator: "Câu 3/10"
   - Nút "Nộp bài" (disabled nếu chưa trả lời hết)
3. **SUBMITTED state:**
   - Hiển thị score, passed/failed
   - Từng câu: ✅/❌ + đáp án đúng + giải thích (nếu có)
   - Nếu passed → lesson auto-marked complete
   - Nút "Làm lại" (nếu còn attempts) hoặc "Tiếp tục"
4. **REVIEW state:** Xem attempts cũ từ `GET /learning/lessons/:lessonId/quiz/attempts`

### Submit flow:
```typescript
const submitQuiz = useSubmitQuiz();

const handleSubmit = () => {
  const answers = Object.entries(selectedAnswers).map(([questionId, selectedOptionId]) => ({
    questionId,
    selectedOptionId,
  }));
  submitQuiz.mutate({ lessonId, answers }, {
    onSuccess: (res) => {
      setQuizResult(res.data);
      setState('SUBMITTED');
    },
  });
};
```

---

## Step 9 — Curriculum Sidebar Component

### Props:
```typescript
interface CurriculumSidebarProps {
  curriculum: ApiSection[];  // sections > chapters > lessons with isCompleted
  currentLessonId: string;
  courseId: string;
  onLessonClick: (lessonId: string) => void;
}
```

### Implementation:
- Sections accordion (collapsible)
- Chapters with lesson list
- Current lesson highlighted
- Completed lessons: ✅ icon
- Incomplete lessons: ○ icon
- Click lesson → navigate (nếu có quyền access)
- Mobile: sidebar trong Sheet (slide from right)

---

## Step 10 — Certificates Page

### Thay đổi chính:
- Replace mock → `useMyCertificates()`
- Card: course title, instructor, completion date, verify code
- Actions: "Xem chứng chỉ" (open URL), "Chia sẻ" (copy verify link)
- Empty state

---

## Commits

| # | Scope | Message |
|---|-------|---------|
| 1 | shared | `feat(shared): add learning and certificate services and hooks` |
| 2 | student | `feat(student): wire my learning dashboard to real api` |
| 3 | student | `feat(student): implement course player with video, text, and quiz` |
| 4 | student | `feat(student): wire certificates page to real api` |

---

## Verification Checklist

### My Learning Dashboard
- [ ] Active courses list from API with progress bars
- [ ] Completed courses list
- [ ] Streak info display
- [ ] "Tiếp tục học" → correct lesson link
- [ ] Tab filter (đang học / hoàn thành)
- [ ] Skeleton loading
- [ ] Empty state

### Course Player — VIDEO
- [ ] Video plays from Cloudinary URL (videoUrl hoặc media[0].url)
- [ ] Resume from lastPosition
- [ ] Progress tracked (debounced 10s)
- [ ] Backend calculates watchedPercent from segments
- [ ] Auto-complete when threshold reached (server-side)

### Course Player — TEXT
- [ ] Renders HTML content with prose classes
- [ ] "Đánh dấu hoàn thành" button works
- [ ] Completed state shows badge

### Course Player — QUIZ
- [ ] Questions render with radio options
- [ ] Cannot submit until all answered
- [ ] Submit → show score, passed/failed
- [ ] Correct/incorrect per question with explanation
- [ ] Max attempts enforced
- [ ] Passed quiz → lesson auto-marked complete
- [ ] "Làm lại" button (if attempts remaining)
- [ ] View past attempts

### Curriculum Sidebar
- [ ] Shows all sections > chapters > lessons
- [ ] Current lesson highlighted
- [ ] Completed lessons ✅ icon
- [ ] Click → navigate to lesson
- [ ] Mobile: Sheet slide-in

### Lesson Navigation
- [ ] Previous/Next lesson buttons
- [ ] Correct order: section → chapter → lesson
- [ ] Disabled at boundaries (first/last)

### Certificates
- [ ] List from API
- [ ] View certificate (open URL)
- [ ] Share (copy verify link)
- [ ] Empty state

### Cross-cutting
- [ ] All pages require auth
- [ ] No mock data imports
- [ ] Dark mode correct
- [ ] Mobile responsive (sidebar → sheet)
- [ ] Build passes

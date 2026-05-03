# Giải thích — Phase 5.13d: Learning (My Learning, Course Player, Certificates)

> Triển khai luồng học tập: dashboard khóa đã ghi danh, course player (video/text/quiz), chứng chỉ.

---

## 1. Luồng học tập hoàn chỉnh

```
┌── MY LEARNING ──┐    ┌── COURSE PLAYER ──┐    ┌── HOÀN THÀNH ──┐
│                  │    │                   │    │                │
│ "Tiếp tục"      │───▷│ VIDEO / TEXT / QUIZ│───▷│ Chứng chỉ     │
│ "Xem lại"       │    │ Sidebar curriculum │    │ (tự động)      │
└──────────────────┘    └───────────────────┘    └────────────────┘
```

### Bước 1: My Learning Dashboard
- Gọi `GET /learning/dashboard` → trả `{ activeCourses, completedCourses, streak }`
- Active courses: hiện progress bar + nút "Tiếp tục" → link tới `nextLesson`
- Completed courses: nút "Xem lại" → link tới `firstLesson` (bài đầu tiên)
- Streak info: chuỗi học hiện tại, dài nhất, đã học hôm nay chưa

### Bước 2: Course Player
- URL: `/courses/{slug}/lessons/{lessonId}`
- Resolve `courseId` từ `slug` qua `useCourseDetail(slug)` (cached)
- Gọi `GET /courses/:courseId/learn/:lessonId` → trả `{ lesson, curriculum }`
- Render theo `lesson.type`: VIDEO → VideoPlayer, TEXT → TextViewer, QUIZ → QuizPlayer
- Sidebar: curriculum với ✅/○ cho từng lesson, highlight bài hiện tại

### Bước 3: Hoàn thành khóa học
- Backend tự tính progress khi lesson complete
- Progress = completedLessons / totalLessons
- Khi progress = 100% + FULL enrollment → auto tạo certificate

---

## 2. Video Player — Segment Tracking

### Mô hình tracking

Frontend không tính `watchedPercent` — chỉ gửi raw segments, **backend tính từ segments**.

```
User xem: 0s──────30s     50s─────80s     90s──100s
Segments:  [0, 30]         [50, 80]        [90, 100]
Total watched: 30 + 30 + 10 = 70s / 100s = 70% → chưa đủ 80%
```

### Luồng gửi progress

```
onPlay       → segmentStart = currentTime
onSeeking    → flush segment [segmentStart, currentTime] (lưu phần đã xem trước khi tua)
onSeeked     → segmentStart = currentTime (bắt đầu segment mới)
onPause      → flush progress to server
onEnded      → flush progress to server
setInterval  → flush mỗi 10 giây (phòng mất data nếu user đóng tab)
unmount      → flush lần cuối
```

### API call:
```
PUT /learning/progress/:lessonId
Body: { lastPosition: 80, watchedSegments: [[0,30],[50,80],[90,100]] }
```

### Backend xử lý:
1. Merge segments hiện tại + segments cũ trong DB
2. Tính `watchedPercent` = tổng watched / tổng duration
3. Nếu `>= 0.8` (80%) → `isCompleted = true`
4. Nếu mới complete → recalculate enrollment progress + track streak

### Chống gian lận tua video:
- User tua tới cuối → chỉ tính 5 giây cuối → `5%` → không đủ 80%
- `onSeeking` flush segment cũ trước khi tua → không mất phần đã xem hợp lệ
- Backend merge segments → xem đi xem lại cùng đoạn không tính thêm

---

## 3. Quiz Player — 4 States

### State machine:
```
READY ──▷ TAKING ──▷ SUBMITTED
  │                      │
  ◁──────────────────────┘ (Retry / Continue)
  │
  ▽
HISTORY (xem attempts cũ)
```

### READY state:
- Hiện quiz info: tên, passing score, max attempts, số lần đã thử
- Nút "Bắt đầu" (disabled nếu hết attempts)
- Nút "Xem lịch sử" (nếu có attempts)

### TAKING state:
- Render từng câu hỏi với radio buttons
- Track answers: `Record<questionId, optionId>`
- Nút "Nộp bài" disabled nếu chưa trả lời hết

### Submit flow:
```
Frontend:
  POST /learning/lessons/:lessonId/quiz/submit
  Body: { answers: [{ questionId, selectedOptionId }] }

Backend:
  1. Tìm quiz với questions + options (có isCorrect)
  2. Check enrollment
  3. Check max attempts
  4. Chấm điểm: đếm correct / total → score (0-1)
  5. So sánh score vs passingScore (normalized)
  6. Lưu QuizAttempt + answers
  7. Nếu passed → mark lesson complete + recalculate progress + track streak
  8. Trả: { attempt: { score: 100, passed: true }, correctCount, totalQuestions, results }

Frontend nhận response:
  - Score hiển thị dạng % (backend đã nhân 100)
  - Từng câu: ✅/❌ + giải thích
  - Nếu passed → lesson tự ✅ trên sidebar
```

### SUBMITTED state:
- Score card: passed/failed + điểm + progress bar
- Chi tiết từng câu: đúng/sai + text câu hỏi + explanation
- Nút "Làm lại" (nếu còn attempts + failed)
- Nút "Tiếp tục"

### HISTORY state:
- Danh sách attempts cũ: điểm, passed/failed, ngày

### API response type mapping:
```typescript
// Backend trả:
{ attempt: { id, score, passed }, correctCount, totalQuestions, results: [{ correct, correctAnswer, explanation }] }

// KHÔNG trả: questionText (frontend lấy từ quiz.questions local)
// KHÔNG trả: isCorrect ở mức option (bảo mật — chỉ reveal sau submit)
```

---

## 4. Text Viewer

Luồng đơn giản:
1. Render HTML content với `dangerouslySetInnerHTML` + `prose` classes
2. Nút "Đánh dấu hoàn thành" → `POST /learning/lessons/:lessonId/complete`
3. Backend: tạo/update LessonProgress `isCompleted: true` → recalculate progress
4. Đã complete → hiện badge ✅, nút disabled

---

## 5. Curriculum Sidebar

### Props: `curriculum`, `currentLessonId`, `onLessonClick`

### Features:
- Sections accordion (auto-expand section chứa bài hiện tại)
- Chapters với lesson list
- Current lesson: `bg-primary/10` highlight
- Completed: ✅ icon, Incomplete: ○ icon
- Click lesson → navigate (nếu bị 403 → hiện trang lỗi inline, không redirect)
- Mobile: overlay sidebar với backdrop

---

## 6. Access Denied Handling (403)

### Vấn đề cũ:
Click vào lesson chưa mua → API trả 403 → TanStack Query retry 3 lần → api-client cố refresh token → loading vô hạn.

### Giải pháp:
1. **`useLesson` custom retry** — skip retry cho `LESSON_ACCESS_DENIED` và `LESSON_NOT_FOUND`
2. **Error state inline** — hiện "Không có quyền truy cập" + "Bạn chưa mua chương này" + nút "Quay lại"
3. **Không redirect** — ở yên trang hiện tại, user ấn "Quay lại" (`router.back()`)

```typescript
retry: (failureCount, error) => {
  const code = (error as { code?: string })?.code;
  if (code === 'LESSON_ACCESS_DENIED' || code === 'LESSON_NOT_FOUND') return false;
  return failureCount < 3;
}
```

---

## 7. Dashboard API Response Shape

### Vấn đề:
Backend `getDashboard` spread enrollment trực tiếp: `{ ...enrollment, nextLesson }`.
Frontend ban đầu expect nested: `item.enrollment.progress`.
→ `item.enrollment` undefined → progress = 0%.

### Giải pháp:
Frontend types match API response (enrollment fields spread):
```typescript
interface ActiveCourse {
  id: string;        // enrollment.id
  progress: number;  // enrollment.progress (0-1)
  courseId: string;
  course: { ... };
  nextLesson: { ... } | null;
}
```

---

## 8. passingScore Double Division Bug

### Vấn đề:
- Frontend quiz-builder gửi `passingScore: 0.6` (đã chia 100)
- Backend quizzes.service lại chia 100 nữa: `dto.passingScore / 100 = 0.006`
- Quiz với passingScore `0.006` → score `1.0 >= 0.006` = luôn pass (hoặc hiển thị 1%)

### Giải pháp:
- Backend bỏ chia 100: `passingScore: dto.passingScore ?? 0.7`
- Backend quiz-attempts normalize khi compare: nếu `passingScore > 1` thì chia 100 (backward compat)
- Frontend hiển thị: `Math.round(passingScore * 100)%`

---

## 9. Completed Course — "Xem lại" Button

### Vấn đề:
Completed courses không có `nextLesson` (tất cả đã complete) → nút "Xem lại" link về `/courses/${slug}` (course detail page) thay vì course player.

### Giải pháp:
- Backend: dashboard trả thêm `firstLesson` cho completed courses (bài đầu tiên theo order)
- Frontend: `targetLessonId = nextLesson?.id ?? firstLessonId`
- Review button → `/courses/${slug}/lessons/${firstLessonId}` → vào course player bài 1

---

## 10. Header Portal Pattern

### Vấn đề:
Learning layout có minimal header, nhưng course title + progress phải dynamic theo lesson data. Layout không re-render khi navigate giữa lessons.

### Giải pháp:
Layout render `<div id="learning-header-slot">` trống. Lesson page dùng `createPortal` để render content vào slot:

```typescript
function HeaderContent({ title, progress }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => { setContainer(document.getElementById('learning-header-slot')); }, []);
  if (!container) return null;
  return createPortal(<div>...</div>, container);
}
```

---

## Tóm tắt files

### Tạo mới (9 files)
| File | Mục đích |
|------|----------|
| `services/learning.service.ts` | API: getLesson, updateProgress, completeLesson, submitQuiz, getDashboard, getStreak |
| `services/certificate.service.ts` | API: getMy, verify |
| `queries/use-learning.ts` | 8 hooks: useLesson (custom retry), useUpdateProgress, useCompleteLesson, useSubmitQuiz, useLearningDashboard, etc. |
| `queries/use-certificates.ts` | useMyCertificates |
| `components/learning/video-player.tsx` | HTML5 video + segment tracking + 10s flush |
| `components/learning/text-viewer.tsx` | HTML viewer + mark complete |
| `components/learning/quiz-player.tsx` | 4-state quiz (READY/TAKING/SUBMITTED/HISTORY) |
| `components/learning/curriculum-sidebar.tsx` | Sections accordion + completion status |
| `components/learning/lesson-nav.tsx` | Prev/Next navigation |

### Sửa đổi (12 files)
| File | Thay đổi |
|------|----------|
| `services/index.ts` + `index.ts` | Export 10 hooks mới + 2 services |
| `my-learning/page.tsx` | Dashboard API, streak, enrollment spread type, Review button |
| `(learning)/layout.tsx` | Minimal header với portal slot |
| `(learning)/.../page.tsx` | Slug→courseId resolution, type-based render, 403 error handling |
| `certificates/page.tsx` | API data, share verify link |
| `course-player.service.ts` | Thêm `videoUrl` vào response |
| `quiz-attempts.service.ts` | Normalize passingScore |
| `quizzes.service.ts` | Bỏ double /100 |
| `streaks.service.ts` | Trả firstLesson cho completed courses |
| `vi.json` + `en.json` | ~30 keys mới |

---

## Bài học rút ra

1. **Backend response shape phải verify** — Dashboard API spread enrollment fields, frontend expect nested object → progress = 0%. Luôn log response thật trước khi viết types.

2. **Segment tracking chống gian lận** — Tua video chỉ tính thời gian thực sự xem. `onSeeking` flush segment cũ trước khi tua, tránh mất progress hợp lệ.

3. **Quiz security** — `isCorrect` flag KHÔNG BAO GIỜ gửi tới client. Chỉ reveal `correctAnswer` trong response sau submit. Frontend lấy question text từ local quiz data.

4. **Custom retry cho TanStack Query** — 403 (access denied) không nên retry. Default retry 3 lần + api-client refresh token → 6+ API calls vô nghĩa.

5. **Portal pattern cho layout slots** — Layout không re-render khi navigate giữa pages cùng group. Dùng `createPortal` để page inject content vào layout header dynamically.

6. **Conversion consistency** — passingScore phải có 1 nơi duy nhất convert. Frontend gửi decimal (0.6), backend lưu decimal. Không convert ở cả 2 nơi.

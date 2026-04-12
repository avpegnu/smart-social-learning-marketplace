# Implementation 5.13i — Placement Test (Student Portal)

> Frontend cho tính năng Placement Test — wizard 3 bước: chọn category → làm bài → xem kết quả + recommended courses.

---

## 1. TỔNG QUAN

### 1.1 Mục tiêu

Student làm bài test đánh giá trình độ → hệ thống recommend level phù hợp (BEGINNER / INTERMEDIATE / ADVANCED) → gợi ý khóa học matching level đó.

### 1.2 Backend API (đã implement)

| Endpoint | Method | Auth | Input | Output |
|----------|--------|------|-------|--------|
| `/placement-tests/start` | POST | Public | `{ categoryId?: string }` | `{ questions: Question[], totalQuestions: number }` |
| `/placement-tests/submit` | POST | JWT | `{ answers: { questionId, selectedOptionId }[] }` | `{ testId, level, scores, recommendedCourses }` |

**Question shape:**
```typescript
{
  id: string;
  question: string;
  options: { id: string; text: string }[];
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}
```

**Submit response:**
```typescript
{
  testId: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  scores: { BEGINNER: number; INTERMEDIATE: number; ADVANCED: number };
  recommendedCourses: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    level: string;
  }[];
}
```

### 1.3 Phạm vi

| Layer | Files | Nội dung |
|-------|-------|----------|
| Shared | 3 files | placement.service.ts, use-placement.ts, index.ts update |
| Frontend | 4 files | placement-test page (3 step components), i18n (en + vi) |
| Integration | 2 files | Homepage CTA, navbar link |

---

## 2. SHARED LAYER

### 2.1 Placement Service

**File:** `packages/shared-hooks/src/services/placement.service.ts`

```typescript
import { apiClient } from '@shared/api-client';

export interface PlacementQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}

export interface PlacementStartResponse {
  questions: PlacementQuestion[];
  totalQuestions: number;
}

export interface PlacementAnswer {
  questionId: string;
  selectedOptionId: string;
}

export interface PlacementResult {
  testId: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  scores: Record<string, number>;
  recommendedCourses: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    level: string;
  }[];
}

export const placementService = {
  startTest: (categoryId?: string) =>
    apiClient.post<PlacementStartResponse>('/placement-tests/start', {
      categoryId: categoryId || undefined,
    }),

  submitTest: (answers: PlacementAnswer[]) =>
    apiClient.post<PlacementResult>('/placement-tests/submit', { answers }),
};
```

**Lý do thiết kế:**
- 2 methods tương ứng 2 endpoints
- Types export riêng để page component dùng
- `categoryId` optional — không truyền = general test

### 2.2 Placement Hook

**File:** `packages/shared-hooks/src/queries/use-placement.ts`

```typescript
'use client';

import { useMutation } from '@tanstack/react-query';
import { placementService } from '../services/placement.service';
import type { PlacementAnswer } from '../services/placement.service';

export function useStartPlacement() {
  return useMutation({
    mutationFn: (categoryId?: string) => placementService.startTest(categoryId),
  });
}

export function useSubmitPlacement() {
  return useMutation({
    mutationFn: (answers: PlacementAnswer[]) => placementService.submitTest(answers),
  });
}
```

**Lý do dùng mutation thay vì query:**
- `startTest` là POST (có side effect — shuffle questions mỗi lần gọi)
- `submitTest` là POST (lưu kết quả vào DB)
- Không cần cache — mỗi test là unique
- Component control khi nào gọi (button click), không phải auto-fetch

### 2.3 Export từ index.ts

Thêm vào `packages/shared-hooks/src/index.ts`:
```typescript
// Services
export { placementService } from './services/placement.service';
export type { PlacementQuestion, PlacementAnswer, PlacementResult, PlacementStartResponse } from './services/placement.service';

// Hooks
export { useStartPlacement, useSubmitPlacement } from './queries/use-placement';
```

---

## 3. PLACEMENT TEST PAGE — WIZARD 3 BƯỚC

### 3.1 Route

**File:** `apps/student-portal/src/app/[locale]/(main)/placement-test/page.tsx`

URL: `/placement-test` (vi) hoặc `/en/placement-test` (en)

### 3.2 State Machine

```
┌─────────────┐    Start     ┌─────────────┐    Submit    ┌─────────────┐
│  CATEGORY   │ ──────────►  │   TAKING     │ ──────────► │   RESULT    │
│  SELECT     │              │   QUIZ       │             │   DISPLAY   │
└─────────────┘              └─────────────┘             └─────────────┘
     Step 1                       Step 2                      Step 3
```

**State type:**
```typescript
type Step = 'select' | 'taking' | 'result';
```

**Component state:**
```typescript
const [step, setStep] = useState<Step>('select');
const [selectedCategory, setSelectedCategory] = useState<string>('');
const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId → selectedOptionId
const [result, setResult] = useState<PlacementResult | null>(null);
```

### 3.3 Step 1 — Category Select

**Layout:**
```
┌─────────────────────────────────────────────────┐
│                  🎯 Placement Test               │
│       Đánh giá trình độ để tìm khóa phù hợp     │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  📚 Chọn lĩnh vực (tùy chọn)               │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │  🖥️ Web  │  │  📱 App  │  │  🎨 UI   │  │ │
│  │  │  Dev     │  │  Dev     │  │  Design  │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  │                                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │  📊 Data │  │  ☁️ Cloud│  │  🤖 AI   │  │ │
│  │  │  Science │  │          │  │          │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ℹ️ 15 câu hỏi · ~5 phút · Không giới hạn thời │
│     gian · Kết quả gợi ý khóa học phù hợp       │
│                                                   │
│        [ Bỏ qua, làm tổng quát ]                │
│        [ ▶ Bắt đầu kiểm tra ]                   │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Chi tiết UI:**
- **Header**: icon Target + title + subtitle mô tả mục đích
- **Category grid**: dùng `useCategories()` hook (đã có). Grid 2 cols mobile, 3 cols desktop
- **Category card**: mỗi card là `button` — border highlight khi selected (`border-primary bg-primary/5`), icon/emoji placeholder (lấy từ category name first letter), tên category
- **Info bar**: icon Info + text mô tả test (15 questions, ~5 min, no time limit)
- **Actions**:
  - "Bỏ qua, làm tổng quát" — `variant="ghost"`, gọi `startTest()` không truyền categoryId
  - "Bắt đầu kiểm tra" — `variant="default"`, gọi `startTest(selectedCategory)`
  - Cả 2 button disabled khi `startMutation.isPending`

**Logic khi Start:**
```typescript
const handleStart = (categoryId?: string) => {
  startMutation.mutate(categoryId, {
    onSuccess: (data) => {
      setQuestions(data.data.questions);
      setStep('taking');
    },
  });
};
```

### 3.4 Step 2 — Taking Quiz

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  ← Quay lại                     Câu 3 / 15     │
│  ████████░░░░░░░░░░░░░░░░░░░░░  20%            │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  Câu 3                           ● Cơ bản   │ │
│  │                                              │ │
│  │  React hook nào dùng để quản lý state        │ │
│  │  trong functional component?                 │ │
│  │                                              │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  ○  useEffect                          │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  ◉  useState                    ✓      │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  ○  useRef                             │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────┐ │ │
│  │  │  ○  useMemo                            │ │ │
│  │  └────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│            [ ← Trước ]    [ Tiếp → ]             │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Chi tiết UI:**

1. **Top bar:**
   - Nút "Quay lại" (`variant="ghost"`, icon ArrowLeft) — confirm dialog "Bạn có chắc muốn hủy bài test? Tiến trình sẽ bị mất."
   - Progress text: "Câu {current} / {total}"

2. **Progress bar:**
   - `Progress` component từ `@shared/ui`
   - Value = `(answeredCount / totalQuestions) * 100`
   - `answeredCount` = số câu đã chọn đáp án (not currentIndex)

3. **Question card:**
   - **Header**: "Câu {n}" + Badge level (`BEGINNER` = xanh lá, `INTERMEDIATE` = vàng, `ADVANCED` = đỏ)
   - **Question text**: `text-lg font-medium` trên Card
   - **Options**: radio-style buttons (theo pattern QuizPlayer)
     - Mỗi option là `<button>` full width
     - Unselected: `border-border hover:bg-accent/50`
     - Selected: `border-primary bg-primary/5`
     - Left side: radio circle indicator (custom div, filled khi selected)
     - Right side: checkmark icon khi selected

4. **Navigation:**
   - "Trước" — `variant="outline"`, disabled khi `currentIndex === 0`
   - "Tiếp" — `variant="default"`, disabled khi chưa chọn đáp án cho câu hiện tại
   - Câu cuối: "Tiếp" → "Nộp bài" (`variant="default"` màu primary, icon SendHorizontal)
   - "Nộp bài" disabled khi chưa trả lời hết OR `submitMutation.isPending`

**Level Badge mapping:**
```typescript
const levelConfig = {
  BEGINNER: { label: t('levelBeginner'), variant: 'success' as const },
  INTERMEDIATE: { label: t('levelIntermediate'), variant: 'warning' as const },
  ADVANCED: { label: t('levelAdvanced'), variant: 'destructive' as const },
};
```

**Logic khi chọn đáp án:**
```typescript
const handleSelectOption = (optionId: string) => {
  setAnswers((prev) => ({
    ...prev,
    [questions[currentIndex].id]: optionId,
  }));
};
```

**Logic khi Submit:**
```typescript
const handleSubmit = () => {
  const answerPayload = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
    questionId,
    selectedOptionId,
  }));

  submitMutation.mutate(answerPayload, {
    onSuccess: (data) => {
      setResult(data.data);
      setStep('result');
    },
  });
};
```

### 3.5 Step 3 — Result Display

**Layout:**
```
┌─────────────────────────────────────────────────┐
│                                                   │
│                 🎓                                │
│           Kết quả đánh giá                       │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │        Trình độ đề xuất của bạn:            │ │
│  │                                              │ │
│  │        ████████████████████████              │ │
│  │             INTERMEDIATE                     │ │
│  │              Trung cấp                       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │  Cơ bản   │ │ Trung cấp │ │ Nâng cao  │      │
│  │   3/5     │ │   4/5     │ │   2/5     │      │
│  │   60%     │ │   80%     │ │   40%     │      │
│  │  ██████░░ │ │ ████████░ │ │ ████░░░░░ │      │
│  └───────────┘ └───────────┘ └───────────┘      │
│                                                   │
│  ── Khóa học phù hợp ──────────────────────     │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Course 1 │ │ Course 2 │ │ Course 3 │         │
│  │          │ │          │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│                                                   │
│     [ 🔄 Làm lại ]    [ 📚 Xem tất cả khóa ]  │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Chi tiết UI:**

1. **Header area:**
   - Icon GraduationCap lớn (h-16 w-16) với background gradient
   - Title "Kết quả đánh giá"
   - Subtitle tùy level: "Bạn phù hợp với các khóa học trình độ {level}"

2. **Level display card:**
   - Card nổi bật với background gradient tùy level
   - Level text lớn, bold
   - Badge variant matching level

3. **Score breakdown:**
   - Grid 3 columns (1 col mobile)
   - Mỗi card hiển thị:
     - Level label + Badge
     - Score: `{correct}/{total}`
     - Percentage: `{Math.round(correct/total*100)}%`
     - Progress bar (color tùy level)
   - **Tính correct/total:** Backend trả `scores` (correct counts) nhưng không trả `totals`. Cần derive từ questions.
   - **Giải pháp:** Lưu thêm `questionsByLevel` vào state khi start test:
     ```typescript
     const questionsByLevel = {
       BEGINNER: questions.filter(q => q.level === 'BEGINNER').length,
       INTERMEDIATE: questions.filter(q => q.level === 'INTERMEDIATE').length,
       ADVANCED: questions.filter(q => q.level === 'ADVANCED').length,
     };
     ```

4. **Recommended courses:**
   - Section header: "Khóa học phù hợp với bạn"
   - Nếu `recommendedCourses.length > 0`: grid cards
     - Mỗi card: thumbnail (hoặc gradient placeholder), title, level badge
     - Click → navigate tới `/courses/{slug}`
   - Nếu empty: empty state message "Chưa có khóa học phù hợp, hãy khám phá tất cả"

5. **Actions:**
   - "Làm lại" — `variant="outline"`, icon RotateCcw → reset state, back to step 1
   - "Xem tất cả khóa học" — `variant="default"`, icon ArrowRight → Link to `/courses?level={result.level}`
   - "Trang chủ" — `variant="ghost"` → Link to `/`

---

## 4. I18N KEYS

### 4.1 Namespace: `placementTest`

**en.json:**
```json
{
  "placementTest": {
    "title": "Placement Test",
    "subtitle": "Assess your level to find the right courses for you",
    "selectCategory": "Choose a field (optional)",
    "selectCategoryDesc": "Select a category to get questions tailored to your interest, or take a general test",
    "testInfo": "15 questions · ~5 minutes · No time limit · Results suggest courses for your level",
    "skipGeneral": "Skip, take general test",
    "startTest": "Start Test",
    "starting": "Loading questions...",

    "question": "Question {current}",
    "questionOf": "Question {current} / {total}",
    "levelBeginner": "Beginner",
    "levelIntermediate": "Intermediate",
    "levelAdvanced": "Advanced",
    "previous": "Previous",
    "next": "Next",
    "submit": "Submit Test",
    "submitting": "Submitting...",
    "confirmQuit": "Are you sure you want to quit?",
    "confirmQuitDesc": "Your progress will be lost and answers won't be saved.",
    "confirmQuitYes": "Quit test",
    "confirmQuitNo": "Continue",
    "unanswered": "{count} question(s) not answered yet",

    "resultTitle": "Assessment Result",
    "resultSubtitle": "You are best suited for {level} level courses",
    "recommendedLevel": "Your recommended level",
    "scoreBreakdown": "Score Breakdown",
    "correct": "{score}/{total} correct",
    "recommendedCourses": "Courses for you",
    "noRecommendations": "No matching courses found. Explore all available courses!",
    "retake": "Retake Test",
    "viewCourses": "View All Courses",
    "backHome": "Back to Home",

    "ctaTitle": "Not sure where to start?",
    "ctaDesc": "Take a quick placement test to find courses that match your level",
    "ctaButton": "Take Placement Test"
  }
}
```

**vi.json:**
```json
{
  "placementTest": {
    "title": "Bài kiểm tra trình độ",
    "subtitle": "Đánh giá trình độ để tìm khóa học phù hợp với bạn",
    "selectCategory": "Chọn lĩnh vực (tùy chọn)",
    "selectCategoryDesc": "Chọn danh mục để nhận câu hỏi phù hợp với sở thích, hoặc làm bài kiểm tra tổng quát",
    "testInfo": "15 câu hỏi · ~5 phút · Không giới hạn thời gian · Kết quả gợi ý khóa học phù hợp",
    "skipGeneral": "Bỏ qua, làm bài tổng quát",
    "startTest": "Bắt đầu kiểm tra",
    "starting": "Đang tải câu hỏi...",

    "question": "Câu {current}",
    "questionOf": "Câu {current} / {total}",
    "levelBeginner": "Cơ bản",
    "levelIntermediate": "Trung cấp",
    "levelAdvanced": "Nâng cao",
    "previous": "Trước",
    "next": "Tiếp",
    "submit": "Nộp bài",
    "submitting": "Đang nộp...",
    "confirmQuit": "Bạn có chắc muốn thoát?",
    "confirmQuitDesc": "Tiến trình sẽ bị mất và câu trả lời sẽ không được lưu.",
    "confirmQuitYes": "Thoát bài test",
    "confirmQuitNo": "Tiếp tục",
    "unanswered": "Còn {count} câu chưa trả lời",

    "resultTitle": "Kết quả đánh giá",
    "resultSubtitle": "Bạn phù hợp với các khóa học trình độ {level}",
    "recommendedLevel": "Trình độ đề xuất của bạn",
    "scoreBreakdown": "Chi tiết điểm số",
    "correct": "{score}/{total} đúng",
    "recommendedCourses": "Khóa học dành cho bạn",
    "noRecommendations": "Chưa có khóa học phù hợp. Hãy khám phá tất cả khóa học!",
    "retake": "Làm lại",
    "viewCourses": "Xem tất cả khóa học",
    "backHome": "Về trang chủ",

    "ctaTitle": "Chưa biết bắt đầu từ đâu?",
    "ctaDesc": "Làm bài kiểm tra nhanh để tìm khóa học phù hợp trình độ của bạn",
    "ctaButton": "Làm bài kiểm tra trình độ"
  }
}
```

---

## 5. HOMEPAGE INTEGRATION

### 5.1 Placement Test CTA Section

**Vị trí:** Sau section "Why Us" (cuối homepage), trước footer. Đây là vị trí hợp lý vì:
- Student đã xem courses, categories, recommendations
- Nếu vẫn chưa biết chọn gì → CTA placement test là next action tự nhiên

**UI:**
```
┌─────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐ │
│  │  gradient background (primary → violet)     │ │
│  │                                              │ │
│  │  🎯 Chưa biết bắt đầu từ đâu?              │ │
│  │  Làm bài kiểm tra nhanh để tìm khóa học    │ │
│  │  phù hợp trình độ của bạn                   │ │
│  │                                              │ │
│  │       [ ▶ Làm bài kiểm tra trình độ ]       │ │
│  │                                              │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Thêm section cuối homepage `page.tsx`
- Gradient card (`from-primary/10 to-violet-500/10`) với border
- Icon Target, title, subtitle, CTA button
- Button link tới `/placement-test`
- Không cần auth — test start endpoint là public

### 5.2 Navbar Link (Optional)

Không thêm vào navbar chính vì sẽ làm cluttered. Placement test là one-time action, không phải daily navigation. CTA trên homepage + link từ My Learning page (nếu chưa có enrolled course) là đủ.

---

## 6. EDGE CASES & UX DETAILS

### 6.1 Không có questions

Nếu `startTest` trả về `questions.length === 0` (category không có placement questions):
- Hiển thị empty state: "Chưa có câu hỏi cho lĩnh vực này"
- CTA: "Thử lĩnh vực khác" hoặc "Làm bài tổng quát"

### 6.2 User chưa login khi submit

`POST /placement-tests/submit` cần JWT. Nếu user chưa login:
- Step 1 + Step 2 hoạt động bình thường (start là public)
- Khi bấm "Nộp bài" → check auth state → nếu chưa login:
  - Hiển thị dialog: "Đăng nhập để lưu kết quả"
  - CTA: "Đăng nhập" (redirect to login with `?redirect=/placement-test`)
  - Hoặc: Cho phép submit mà không lưu (hiển thị result nhưng cảnh báo "Kết quả không được lưu")
- **Recommendation:** Require login trước khi submit. Show login prompt ngay khi bấm "Nộp bài" nếu chưa auth.

### 6.3 Network error giữa chừng

- Start test fail → toast error, giữ nguyên step 1
- Submit fail → toast error, giữ nguyên step 2 (answers không mất)
- Dùng `onError` callback trong mutation

### 6.4 Browser back button / navigation

- Step 2 (đang làm bài): warn trước khi rời trang
  - Dùng `beforeunload` event: `window.addEventListener('beforeunload', handler)`
  - Khi step !== 'taking' → remove listener

### 6.5 Responsive

- Mobile: category grid 2 cols, question options full-width, nav buttons stack
- Desktop: category grid 3 cols, max-width container (max-w-2xl), centered layout

---

## 7. COMPONENT STRUCTURE

```
apps/student-portal/src/
├── app/[locale]/(main)/
│   └── placement-test/
│       └── page.tsx              # Main wizard page (state machine)
├── components/
│   └── placement/
│       ├── category-select.tsx   # Step 1: Category selection
│       ├── quiz-taking.tsx       # Step 2: Questions & answers
│       └── test-result.tsx       # Step 3: Results & recommendations
```

**Lý do tách component:**
- Mỗi step ~100-150 lines → tách ra giữ file <200 lines
- Page chỉ quản lý state machine + chuyển step
- Props truyền xuống rõ ràng, không cần context

### 7.1 Props interfaces

```typescript
// category-select.tsx
interface CategorySelectProps {
  onStart: (categoryId?: string) => void;
  isPending: boolean;
}

// quiz-taking.tsx
interface QuizTakingProps {
  questions: PlacementQuestion[];
  onSubmit: (answers: PlacementAnswer[]) => void;
  onQuit: () => void;
  isPending: boolean;
}

// test-result.tsx
interface TestResultProps {
  result: PlacementResult;
  questionsByLevel: Record<string, number>;
  onRetake: () => void;
}
```

---

## 8. COMMITS PLAN

### Commit 1: Shared — placement service + hooks
**Files:**
- `packages/shared-hooks/src/services/placement.service.ts` (NEW)
- `packages/shared-hooks/src/queries/use-placement.ts` (NEW)
- `packages/shared-hooks/src/index.ts` (UPDATE — add exports)

### Commit 2: Student — placement test page + components + i18n
**Files:**
- `apps/student-portal/src/app/[locale]/(main)/placement-test/page.tsx` (NEW)
- `apps/student-portal/src/components/placement/category-select.tsx` (NEW)
- `apps/student-portal/src/components/placement/quiz-taking.tsx` (NEW)
- `apps/student-portal/src/components/placement/test-result.tsx` (NEW)
- `apps/student-portal/messages/en.json` (UPDATE — add `placementTest` namespace)
- `apps/student-portal/messages/vi.json` (UPDATE — add `placementTest` namespace)

### Commit 3: Student — homepage placement test CTA
**Files:**
- `apps/student-portal/src/app/[locale]/(main)/page.tsx` (UPDATE — add CTA section)
- `apps/student-portal/messages/en.json` (UPDATE — add CTA i18n keys if not in commit 2)
- `apps/student-portal/messages/vi.json` (UPDATE — add CTA i18n keys if not in commit 2)

---

## 9. VERIFICATION

1. `npm run build --workspace=packages/shared-hooks` — shared hooks builds
2. `npm run build --workspace=apps/student-portal` — student portal builds
3. Navigate to `/placement-test` → step 1 renders categories
4. Select category → Start → 15 questions load
5. Answer all → Submit → result shows level + courses
6. Skip category → general test works
7. Retake → reset to step 1
8. Homepage CTA → links to placement test
9. Dark mode: all steps look correct
10. Mobile: responsive layout on all steps
11. vi + en: all text translated

---

## 10. FILES TỔNG QUAN

| Commit | Created | Modified |
|--------|---------|----------|
| 1. Shared layer | 2 | 1 |
| 2. Placement page | 4 | 2 |
| 3. Homepage CTA | 0 | 1-3 |
| **Total** | **6** | **~4-6** |

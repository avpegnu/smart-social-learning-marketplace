# Phase 7.15: Inline AI Tutor on the Learning Screen

> **Date:** 2026-06-08
> **Status:** ✅ Code complete — chờ user test live
> **Scope:** Thêm cửa sổ chat AI Tutor nổi (floating) ngay trên màn học bài (`/courses/[slug]/lessons/[lessonId]`), để học viên hỏi AI mà không phải rời trang sang `/ai-tutor`. Tái sử dụng tối đa logic streaming AI có sẵn. **Không thay đổi backend.**

---

## 1. Tổng quan

### Mục tiêu

Hiện tại muốn hỏi AI Tutor, học viên phải rời màn học sang trang `/ai-tutor` riêng → mất ngữ cảnh bài đang học, bất tiện. Phase này đưa AI Tutor vào ngay màn học dưới dạng **cửa sổ chat nổi** (giống cửa sổ chat với người ở Phase 7.14), khoá theo đúng khóa học đang học.

Trải nghiệm:

- **AiTutorLauncher** — Nút nổi (icon Sparkles) ở góc dưới phải màn học. Click để mở/đóng widget.
- **AiTutorWidget** — Panel chat nổi với **2 view**:
  - **Danh sách session** — list các phiên hội thoại AI **chỉ của khóa hiện tại**, nút "Hội thoại mới", badge quota `x/10`.
  - **Chat** — chat streaming bình thường với AI; có nút back để quay lại chọn session khác. Vẫn hiển thị quota.
- **Enroll-gate** — Học viên xem bài preview miễn phí (chưa đăng ký) vẫn thấy nút, nhưng mở ra là lời mời đăng ký (vì backend chặn AI theo enrollment).

### Quyết định sản phẩm (chốt với user)

| Câu hỏi | Lựa chọn | Hệ quả kỹ thuật |
|---------|----------|-----------------|
| Phạm vi ngữ cảnh AI | **Theo cả khóa học** (không theo từng bài) | RAG hiện tại đã lọc theo `courseId` → **không cần đổi backend** |
| Mô hình session | List session (theo khóa) ↔ chat, có back, hiển thị quota | Mirror trang `/ai-tutor` nhưng thu nhỏ |
| Bài preview chưa enroll | **Hiện nút, click ra lời mời enroll** | Cần biết trạng thái enroll ở client (`useMyLearning`) |

### Scope thay đổi

| Scope | Loại | File | Risk |
|-------|------|------|------|
| Shared hook | Mới | `packages/shared-hooks/src/use-ai-tutor-chat.ts` | Thấp |
| Shared hook export | Sửa | `packages/shared-hooks/src/index.ts` | Không |
| AI tutor UI | Mới | `apps/student-portal/src/components/ai-tutor/ai-tutor-messages.tsx` | Thấp |
| AI tutor UI | Refactor | `apps/student-portal/src/components/ai-tutor/chat-panel.tsx` | Trung bình* |
| AI tutor page | Refactor | `apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx` | Trung bình* |
| Learning UI | Mới | `apps/student-portal/src/components/learning/ai-tutor-widget.tsx` | Thấp |
| Learning UI | Mới | `apps/student-portal/src/components/learning/ai-tutor-launcher.tsx` | Thấp |
| Learning page | Sửa | `.../(learning)/courses/[slug]/lessons/[lessonId]/page.tsx` | Thấp |
| i18n | Sửa | `apps/student-portal/messages/{vi,en}.json` (thêm 6 keys vào `aiTutor`) | Không |

\* *Risk "trung bình" vì refactor đụng vào trang `/ai-tutor` đang chạy tốt — nhưng đã giữ nguyên hành vi và verify bằng `tsc` + `eslint`.*

**Không động đến:** backend AI tutor module (`apps/api/src/modules/ai-tutor/`), trang `/ai-tutor` về mặt UX (chỉ refactor nội bộ), hạ tầng chat với người (`shared-ui/components/chat`, `chat-windows-store`).

---

## 2. Vấn đề & Motivation

### Trước khi implement

- Màn học (`lessons/[lessonId]/page.tsx`) **không có** lối vào AI Tutor nào. Muốn hỏi phải bấm sang `/ai-tutor`, chọn lại khóa học, rồi mới hỏi → rời ngữ cảnh bài đang xem.
- Toàn bộ logic chat AI (vòng lặp đọc SSE) nằm **inline trong `chat-panel.tsx`** của trang `/ai-tutor`, không thể tái dùng ở nơi khác.

### Tại sao **không** tái dùng cửa sổ chat người (Phase 7.14)?

Hạ tầng `FloatingChatWindows` + `useChatWindowsStore` bị **gắn cứng** vào:
- `conversationId` của chat người,
- socket.io namespace `/chat`,
- message shape `{ sender, ... }`.

AI Tutor dùng **SSE streaming** (không socket) và message shape `{ role, content }`. Generalize hệ thống chat người để nhét AI vào sẽ rủi ro cao cho một tính năng đang chạy tốt, lợi ích thấp. → Làm **widget AI riêng**, *trông giống* chat người nhưng độc lập hoàn toàn (0 rủi ro cho chat người).

---

## 3. Architecture

### 3.1 Layered design

```
packages/shared-hooks
  └─ use-ai-tutor-chat.ts                 [NEW]  — Stateful hook: session + messages + SSE streaming
  └─ queries/use-ai-tutor.ts              [reused] — useAiQuota, useAiSessions, useSessionMessages
  └─ services/ai-tutor.service.ts         [reused] — askStream() (SSE), getSessions, getSessionMessages

apps/student-portal/components/ai-tutor
  └─ ai-tutor-messages.tsx                [NEW]  — Message list + streaming + thinking + auto-scroll (shared)
  └─ chat-panel.tsx                       [REFACTOR] — Giờ là component thuần present, nhận state từ hook
  └─ chat-message.tsx                     [reused]
  └─ markdown-renderer.tsx                [reused]
  └─ streaming-indicator.tsx             [reused]

apps/student-portal/components/learning
  └─ ai-tutor-widget.tsx                  [NEW]  — Cửa sổ nổi: session list ↔ chat, enroll-gate
  └─ ai-tutor-launcher.tsx                [NEW]  — Nút nổi + resolve enrollment + toggle widget

apps/student-portal/app/(fullscreen)/ai-tutor/page.tsx   [REFACTOR] — Dùng useAiTutorChat (DRY)
apps/student-portal/app/(learning)/.../lessons/[lessonId]/page.tsx  [MOUNT] — <AiTutorLauncher />
```

### 3.2 Hook là single source of truth — `useAiTutorChat`

Toàn bộ state + logic của 1 hội thoại AI (theo 1 khóa) gom vào 1 hook, dùng chung cho **cả trang `/ai-tutor` lẫn widget**:

```typescript
const chat = useAiTutorChat({ courseId });
// → { activeSessionId, selectSession, newSession,
//     messages, streamingContent, isThinking, isStreaming,
//     input, setInput, send, canSend, usageCount, dailyLimit }
```

Hook lo:
- Chọn/đổi session (`selectSession`, `newSession`).
- Đồng bộ messages từ server (`useSessionMessages`) — **bỏ qua sync khi đang stream** để giữ optimistic user message (qua `streamingRef`).
- Quota (`useAiQuota`).
- Vòng lặp đọc SSE: parse các event `start | token | done | error`, append message, invalidate `['ai-tutor']` khi xong.
- **Reset hội thoại khi `courseId` đổi** (qua `prevCourseRef`).

### 3.3 Data flow (widget)

```
USER CLICK NÚT NỔI (AiTutorLauncher)
  ↓ useMyLearning() → enrolled?
  ↓
AiTutorWidget mở (view = 'list')
  ↓ useAiSessions(courseId) → list session của khóa hiện tại
  ↓
USER CHỌN SESSION (hoặc "Hội thoại mới")
  ↓ chat.selectSession(id) / chat.newSession()  + setView('chat')
  ↓
View 'chat' → useAiTutorChat đồng bộ messages
  ↓
USER GỬI CÂU HỎI → chat.send()
  ↓ aiTutorService.askStream({ courseId, sessionId, question })  (SSE)
  ↓ đọc stream: start → (token...) → done
  ↓ invalidate ['ai-tutor'] → quota + sessions + messages refetch
  ↓
USER BẤM BACK → setView('list') để chọn session khác
```

### 3.4 Vị trí & z-index

| Element | Class | Ghi chú |
|---------|-------|---------|
| Nút curriculum (mobile) | `fixed right-4 bottom-36 z-30 lg:hidden` | Chỉ mobile; nằm **trên** nút AI |
| **AiTutorLauncher** | `fixed right-4 bottom-20 z-30 lg:bottom-6` | Mobile: **dưới** nút curriculum & **trên** footer prev/next; desktop hạ xuống góc (`lg:bottom-6`) |
| **AiTutorWidget** | `fixed right-4 bottom-20 z-50 lg:bottom-6` | Nổi trên header (z-40) và overlay sidebar mobile (z-20) |

Widget responsive: `w-[calc(100vw-2rem)] max-w-sm`, `h-128 max-h-[calc(100vh-9rem)]` (`max-h` chặn để khi màn hình thấp widget không tràn lên header).

---

## 4. Backend

**Không cần thay đổi.** AI tutor module đã có sẵn và đủ dùng:

- `POST /ai/tutor/ask-stream` — SSE streaming, **chặn theo enrollment**, RAG lọc context theo `courseId`, có quota 10 câu/ngày.
- `GET /ai/tutor/quota`, `GET /ai/tutor/sessions?courseId=`, `GET /ai/tutor/sessions/:id/messages`.

Vì user chọn **ngữ cảnh theo cả khóa**, RAG hiện tại (`WHERE course_id = ...`) đã đáp ứng → bỏ qua hoàn toàn thay đổi backend. (Lesson-scoped retrieval để mở rộng sau — xem §12.)

---

## 5. Frontend Implementation

### 5.1 Hook `useAiTutorChat`

**File:** `packages/shared-hooks/src/use-ai-tutor-chat.ts`

Bê nguyên vòng lặp SSE + state vốn nằm inline trong `chat-panel.tsx` ra một hook độc lập. Điểm chính:

```typescript
// Giữ optimistic user message khi đang stream (không bị server-sync ghi đè)
const streamingRef = useRef(false);
streamingRef.current = isStreaming || isThinking;
useEffect(() => {
  if (sessionMessages && !streamingRef.current) setMessages(sessionMessages.map(...));
}, [sessionMessages]);

// Reset hội thoại khi đổi khóa
const prevCourseRef = useRef(courseId);
useEffect(() => {
  if (prevCourseRef.current !== courseId) { prevCourseRef.current = courseId; /* reset */ }
}, [courseId]);
```

**Vì sao đặt ở `shared-hooks` chứ không phải tạo folder `hooks/` mới trong student-portal?**

- `shared-hooks` đã có `next-intl` + `sonner` trong `peerDependencies` và đã dùng `useTranslations` (trong `use-api-error.ts`) → không kéo thêm dependency mới.
- `shared-hooks` đã chứa các hook **có state** không phải react-query: `use-chat-socket.ts`, `use-notification-socket.ts`, `use-debounce.ts`... → một streaming hook nằm cạnh `aiTutorService` + `useAiQuota`/`useAiSessions` của chính nó là đúng chỗ, nhất quán với codebase.

**Export:** `packages/shared-hooks/src/index.ts`

```typescript
export { useAiTutorChat } from './use-ai-tutor-chat';
export type { ChatMsg } from './use-ai-tutor-chat';
```

### 5.2 `AiTutorMessages` — message list dùng chung

**File:** `apps/student-portal/src/components/ai-tutor/ai-tutor-messages.tsx`

Tách phần render hội thoại (messages + bubble streaming + bubble "đang suy nghĩ" + empty state) + **auto-scroll** thành 1 component, dùng chung cho cả `ChatPanel` (trang) lẫn `AiTutorWidget`.

Auto-scroll được đơn giản hoá so với bản cũ: chỉ ghim xuống đáy khi `isThinking || isStreaming` (lúc AI đang trả lời), không "giật" khi đang xem hội thoại cũ.

```typescript
useEffect(() => {
  if (isThinking || isStreaming) {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }
}, [messages, streamingContent, isThinking, isStreaming]);
```

Prop `emptyState?: ReactNode` cho phép mỗi nơi truyền empty state riêng (trang dùng welcome dài, widget dùng 1 dòng gọn).

### 5.3 Refactor `ChatPanel` → component thuần present

**File:** `apps/student-portal/src/components/ai-tutor/chat-panel.tsx`

Trước: `ChatPanel` nhận ~14 props (state + setters) và **tự chứa vòng lặp SSE** trong `handleSend`.
Sau: bỏ hết logic streaming, nhận state đã tính từ hook qua props, render header + `<AiTutorMessages>` + ô input. Không còn import `aiTutorService`, `toast`, `useQueryClient`.

### 5.4 Refactor trang `/ai-tutor`

**File:** `apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx`

Page giờ gọi `useAiTutorChat({ courseId: selectedCourseId })` và truyền xuống `SessionSidebar` + `ChatPanel`. Page chỉ còn giữ state thuần UI của riêng nó: `selectedCourseId`, `showSidebar`, danh sách khóa (`useMyLearning`), danh sách session (`useAiSessions`). Logic reset-khi-đổi-khóa chuyển vào hook.

→ **Kết quả: trang `/ai-tutor` và widget dùng chung 1 implementation streaming duy nhất (DRY).**

### 5.5 `AiTutorWidget`

**File:** `apps/student-portal/src/components/learning/ai-tutor-widget.tsx`

```typescript
interface AiTutorWidgetProps {
  courseId: string;
  courseSlug: string;     // để link enroll CTA
  isEnrolled: boolean;
  onClose: () => void;
}
type View = 'list' | 'chat';
```

- **Header:** avatar Bot + tiêu đề + badge quota `x/10` (Zap) + nút back (chỉ ở view chat) + nút close (X).
- **Nếu chưa enroll:** icon khoá + `t('enrollPrompt')` + nút `t('enrollCta')` → `router.push('/courses/{slug}')`. Không render chat.
- **View 'list':** nút "Hội thoại mới" → `newSession()` + sang chat; list session (`useAiSessions(courseId)`, chỉ fetch khi enrolled) → click → `selectSession()` + sang chat; empty state `noSessions`; disclaimer ở chân.
- **View 'chat':** `<AiTutorMessages>` + ô input (Enter để gửi, Shift+Enter xuống dòng); banner khi hết quota.

### 5.6 `AiTutorLauncher`

**File:** `apps/student-portal/src/components/learning/ai-tutor-launcher.tsx`

```typescript
interface AiTutorLauncherProps { courseId: string; courseSlug: string; }
```

- Quản lý state `open` (cục bộ).
- Resolve enrollment qua `useMyLearning()` → `enrolled = data.some(e => e.course.id === courseId)` (cùng nguồn dữ liệu trang `/ai-tutor` dùng).
- `open` → render `<AiTutorWidget>`; ngược lại render nút nổi Sparkles.

### 5.7 Mount vào màn học

**File:** `.../(learning)/courses/[slug]/lessons/[lessonId]/page.tsx`

```diff
+ import { AiTutorLauncher } from '@/components/learning/ai-tutor-launcher';
  ...
        {/* Mobile sidebar overlay */}
        {sidebarOpen && ( ... )}
+
+       {/* Inline AI Tutor — floating chat scoped to this course */}
+       {courseId && <AiTutorLauncher courseId={courseId} courseSlug={slug} />}
      </div>
```

`courseId` (từ `useCourseDetail(slug)`) và `slug` (từ params) đã có sẵn trong scope.

### 5.8 i18n keys

**File:** `apps/student-portal/messages/{vi,en}.json` — thêm 6 keys vào namespace `aiTutor` (tái dùng tối đa các key có sẵn: `title`, `newSession`, `noSessions`, `messageCount`, `askPlaceholder`, `usageLimitReached`, `disclaimer`, `errors.*`):

```json
{
  "launcherLabel": "Hỏi AI Tutor" / "Ask AI Tutor",
  "back": "Quay lại" / "Back",
  "close": "Đóng" / "Close",
  "widgetWelcome": "Hỏi mình bất cứ điều gì về khóa học này nhé!" / "Ask me anything about this course!",
  "enrollPrompt": "Đăng ký khóa học này để hỏi AI Tutor về các bài học." / "Enroll in this course to ask the AI Tutor about its lessons.",
  "enrollCta": "Xem khóa học" / "View course"
}
```

---

## 6. Edge Cases & Quyết định thiết kế

### 6.1 Giữ optimistic message khi stream
Như bản cũ: trong lúc đang stream, bỏ qua việc đồng bộ messages từ server (`streamingRef`) để câu hỏi vừa gõ không bị "nháy mất" trước khi AI trả lời xong.

### 6.2 Reset khi đổi khóa
Widget mount theo từng trang bài học, nhưng hook vẫn tự reset hội thoại nếu `courseId` đổi (an toàn nếu sau này mount ở layout). Khi học viên chuyển bài **trong cùng khóa**, `courseId` không đổi → hội thoại giữ nguyên.

### 6.3 Enroll-gate
- `useAiSessions` chỉ fetch khi `isEnrolled` (endpoint chặn enrollment, tránh gọi thừa gây 403).
- Chưa enroll → widget hiện CTA mời đăng ký thay vì khung chat.

### 6.4 Vị trí nút nổi (tránh đè nhau)
- **Mobile:** nút curriculum lên `bottom-36`, nút AI xuống `bottom-20` → AI nằm dưới menu, đồng thời vẫn **trên** footer prev/next (`LessonNav` là footer pinned ở đáy cột nội dung, luôn hiện — nếu để AI ở `bottom-6` sẽ đè nút "Next").
- **Desktop:** không có nút curriculum (sidebar luôn hiện), nút + widget AI hạ xuống góc `lg:bottom-6` (footer prev/next nằm trong cột nội dung, bên trái sidebar nên không vướng `right-4`).

### 6.5 Quota hiển thị liên tục
Header widget luôn hiện `usageCount/dailyLimit`; khi hết quota, nút gửi disabled + banner cảnh báo (đúng yêu cầu user về hiển thị `.../10`).

### 6.6 Fix kèm: curriculum sidebar bị ẩn trên desktop (bug có sẵn, không phải do widget)

**Triệu chứng (user báo khi test):** Trên desktop test xong chuyển sang mobile, **tắt** sidebar, rồi quay lại desktop → menu curriculum biến mất, không có cách nào hiện lại.

**Nguyên nhân:** Trang dùng **1 state `sidebarOpen`** chung cho cả sidebar desktop lẫn drawer mobile, nhưng nút toggle lại là `lg:hidden` (chỉ mobile). Tắt trên mobile → `sidebarOpen = false` → quay về desktop, sidebar thành `w-0` + không render, mà desktop **không có nút mở lại** → kẹt ẩn. Bug **có sẵn từ trước**, widget AI (chỉ là nút `fixed`) không liên quan.

**Fix:** Tách state — desktop sidebar **luôn hiện** (`hidden w-80 lg:block`, độc lập state); drawer mobile dùng state riêng `mobileSidebarOpen` (mặc định **đóng**, đỡ che video khi mới vào bài). Bỏ logic `w-80/w-0` + import `cn` thừa.

---

## 7. Patterns & Best Practices

- ✅ **DRY:** 1 hook streaming duy nhất dùng cho cả trang `/ai-tutor` lẫn widget; 1 component `AiTutorMessages` dùng chung.
- ✅ **Reuse-first:** tái dùng `aiTutorService`, `useAiQuota/Sessions/Messages`, `ChatMessage`, `MarkdownRenderer`, `StreamingIndicator`.
- ✅ **Backend untouched:** không đổi API, không migrate DB.
- ✅ **Không `any`:** SSE event có interface `SseEvent`; cast data có kiểu rõ ràng.
- ✅ **Design tokens + dark mode:** `bg-card`, `bg-muted`, `text-muted-foreground`, `border`, `bg-destructive/10` — không hardcode màu.
- ✅ **i18n:** mọi text qua `useTranslations('aiTutor')`; lỗi backend map qua `aiTutor.errors.*`.
- ✅ **A11y:** `aria-label` cho nút icon-only (back, close, launcher).

---

## 8. Verification (đã chạy)

- [x] `tsc --noEmit -p apps/student-portal/tsconfig.json` — **pass** (gồm cả type của `@shared/hooks`).
- [x] `eslint` trên 6 file mới/sửa của student-portal — **pass, 0 warning** (config resolve 447 rules).
- [x] `eslint "src/**/*.ts"` ở `packages/shared-hooks` — **pass**.
- [x] `vi.json` + `en.json` — JSON hợp lệ.

> ⚠️ **Lưu ý:** Chưa chạy `next build` production và chưa test UX live (cần backend + đăng nhập). Phần checklist §9 bên dưới để **user test thủ công**.

---

## 9. Testing Checklist (chờ user test live)

### 9.1 Màn học — Desktop (đã enroll)
- [ ] Vào bài học → thấy nút nổi Sparkles góc dưới phải.
- [ ] Click nút → widget mở ở view danh sách session (của đúng khóa hiện tại).
- [ ] "Hội thoại mới" → sang view chat, gõ câu hỏi → AI trả lời streaming, auto-scroll xuống đáy.
- [ ] Badge quota `x/10` cập nhật sau mỗi câu hỏi.
- [ ] Bấm back → về danh sách session, thấy session vừa tạo.
- [ ] Chọn session cũ → load lại messages đúng.
- [ ] Click X → widget đóng, nút nổi hiện lại.

### 9.2 Màn học — Bài preview (chưa enroll)
- [ ] Vẫn thấy nút nổi.
- [ ] Click → hiện lời mời "Đăng ký khóa học" + nút "Xem khóa học" → điều hướng `/courses/{slug}`.

### 9.3 Chuyển bài & nhiều khóa
- [ ] Chuyển sang bài khác **cùng khóa** → widget vẫn dùng đúng `courseId`.
- [ ] Vào bài của **khóa khác** → danh sách session đổi theo khóa mới.

### 9.4 Quota
- [ ] Hỏi đến khi hết 10 câu → ô input disabled + banner "Đã hết lượt hỏi hôm nay".

### 9.5 Regression trang `/ai-tutor` cũ
- [ ] Trang `/ai-tutor` vẫn hoạt động đúng (chọn khóa, list session, chat streaming, đổi khóa reset) sau refactor.

### 9.6 Theme & Locale
- [ ] Dark mode: widget, bubble, input đúng theme.
- [ ] vi ↔ en: text widget (launcherLabel, enrollPrompt, back, close...) đổi đúng.

### 9.7 Mobile
- [ ] Nút launcher (bottom-36) không đè nút curriculum (bottom-20).
- [ ] Widget rộng gần full màn hình, vẫn dùng được.

---

## 10. Files Created / Modified

### Created
| File | Purpose |
|------|---------|
| `packages/shared-hooks/src/use-ai-tutor-chat.ts` | Hook streaming AI tutor dùng chung (session + messages + SSE) |
| `apps/student-portal/src/components/ai-tutor/ai-tutor-messages.tsx` | Message list + streaming + auto-scroll dùng chung |
| `apps/student-portal/src/components/learning/ai-tutor-widget.tsx` | Cửa sổ chat nổi (session list ↔ chat, enroll-gate) |
| `apps/student-portal/src/components/learning/ai-tutor-launcher.tsx` | Nút nổi + resolve enrollment + toggle widget |
| `docs/phase7-improvements/15-inline-ai-tutor-on-learning-screen.md` | Tài liệu này |

### Modified
| File | Thay đổi |
|------|----------|
| `packages/shared-hooks/src/index.ts` | Export `useAiTutorChat`, type `ChatMsg` |
| `apps/student-portal/src/components/ai-tutor/chat-panel.tsx` | Bỏ logic SSE; thành component thuần present, dùng `AiTutorMessages` + nhận state từ hook |
| `apps/student-portal/src/app/[locale]/(fullscreen)/ai-tutor/page.tsx` | Dùng `useAiTutorChat` thay cho state inline (DRY) |
| `apps/student-portal/src/app/[locale]/(learning)/courses/[slug]/lessons/[lessonId]/page.tsx` | Mount `<AiTutorLauncher courseId courseSlug />`; **fix bug sidebar ẩn trên desktop** (tách state desktop/mobile — xem §6.6) |
| `apps/student-portal/messages/{vi,en}.json` | Thêm 6 keys vào namespace `aiTutor` |

---

## 11. Migration Notes

- **Không cần migrate DB**, **không đổi env**, **không redeploy backend**.
- Cần restart Next.js dev server sau khi pull (do thêm export ở `shared-hooks` — Next cache module resolution của workspace deps).
- Trang `/ai-tutor` đã được refactor nội bộ nhưng giữ nguyên hành vi — kiểm tra regression theo §9.5.

---

## 12. Summary

✅ **Inline AI Tutor** — Nút nổi trên màn học → widget chat (session list ↔ chat) khoá theo khóa hiện tại, không rời trang.
✅ **Reuse-first** — Tái dùng SSE streaming + hooks + components AI có sẵn; backend không đổi (ngữ cảnh theo khóa đã đủ).
✅ **DRY** — Gom logic streaming vào 1 hook ở `shared-hooks`; trang `/ai-tutor` cũ cũng dùng chung.
✅ **Enroll-aware** — Bài preview chưa enroll → mời đăng ký thay vì chat.
✅ **Độc lập với chat người** — Không đụng hạ tầng `FloatingChatWindows`/socket → 0 rủi ro cho Phase 7.14.
✅ **Type-safe + i18n + dark mode** — Đúng convention CLAUDE.md. `tsc` + `eslint` pass.

---

## 13. Future Enhancements (out of scope)

- [ ] **Lesson-scoped RAG:** thêm `lessonId?` optional vào `AskQuestionDto` + ưu tiên chunk theo bài (fallback về khóa) để AI biết chính xác bài đang học (~2–3h, không cần migrate).
- [ ] Nút "minimize" giữ widget mở xuyên route (mount ở layout `(learning)` + dùng store nhỏ).
- [ ] Prefill câu hỏi từ đoạn text học viên bôi đen trong bài.
- [ ] Hiển thị nguồn (lesson/section) mà AI trích dẫn trong câu trả lời.
- [ ] Gợi ý câu hỏi nhanh (quick prompts) theo loại bài (video/quiz/text).

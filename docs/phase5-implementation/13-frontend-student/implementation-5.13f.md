# Sub-phase 5.13f — Q&A Forum & AI Tutor

> Wire Q&A Forum (list, detail, ask, answer, vote) and AI Tutor (sessions, streaming chat) to real API.
> Dependencies: 5.13a (Auth), 5.13d (Learning — for enrolled courses).
> **Includes backend modifications:** SSE streaming, unique view tracking, userVote per answer, quota endpoint.

---

## Backend Changes

### Q&A Module — Enhanced

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/questions` | Public | List with filters (courseId, search, status) |
| `GET` | `/questions/similar?title=xxx` | Public | Find similar questions (max 5) |
| `GET` | `/questions/:id` | Public (optional JWT) | Detail with answers + `userVote` per answer |
| `POST` | `/questions` | Auth | Create question |
| `PUT` | `/questions/:id` | Owner | Update question |
| `DELETE` | `/questions/:id` | Owner | Delete question |
| `POST` | `/questions/:id/answers` | Auth | Post answer (min 1 char) |
| `PUT` | `/questions/:id/best-answer` | Owner/Instructor | Mark best answer |
| `DELETE` | `/answers/:id` | Owner | Delete answer |
| `POST` | `/answers/:id/vote` | Auth | Vote on answer (value: -1, 0, 1) |

**Backend changes made:**

1. **Unique view tracking** (`questions.service.ts`)
   - Inject `RedisService` into `QuestionsService`
   - `findById(questionId, viewerId?)` — uses Redis SET `qview:{questionId}`
   - `sadd(viewerId)` returns 1 only on first view → increment `viewCount`
   - TTL 30 days on the SET key
   - No viewerId (unauthenticated) → no view counted

2. **userVote per answer** (`questions.service.ts`)
   - `findById` includes `votes` relation filtered by `viewerId` when authenticated
   - Maps each answer to include `userVote: votes?.[0]?.value ?? null`
   - Frontend initializes vote buttons from this value (survives F5)

3. **Controller passes viewerId** (`questions.controller.ts`)
   - `GET /questions/:id` route is `@Public()` with optional JWT parsing
   - `@CurrentUser() user?: JwtPayload` → passes `user?.sub` to service

4. **Answer min length relaxed** (`create-answer.dto.ts`)
   - Changed `@MinLength(10)` → `@MinLength(1)`

### AI Tutor Module — Enhanced

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/tutor/ask` | Auth | Ask question (non-streaming JSON) |
| `POST` | `/ai/tutor/ask-stream` | Auth | Ask question (SSE streaming) |
| `GET` | `/ai/tutor/quota` | Auth | Get daily usage quota from Redis |
| `GET` | `/ai/tutor/sessions` | Auth | List sessions |
| `GET` | `/ai/tutor/sessions/:id/messages` | Auth (owner) | Get session messages |

**Backend changes made:**

1. **SSE streaming endpoint** (`ai-tutor.controller.ts`)
   - `POST /ai/tutor/ask-stream` with `@Res()` manual SSE headers
   - `Content-Type: text/event-stream`, `Cache-Control: no-cache`
   - Iterates async generator, writes `data: JSON\n\n` per event
   - Error catch → sends `{ type: 'error', code }` event

2. **Async generator** (`ai-tutor.service.ts`)
   - `askQuestionStream()` → `AsyncGenerator<StreamEvent>`
   - StreamEvent: `start | token | done | error`
   - Same gates as `askQuestion()`: rate limit (Redis 10/day) + enrollment check
   - Yields `start` immediately after session creation
   - Uses `stream: true` on Groq SDK → `for await (chunk of stream)`
   - 30ms delay per token in dev mode for visible streaming effect
   - Saves complete answer to DB after stream finishes

3. **Quota endpoint** (`ai-tutor.service.ts`)
   - `getQuota(userId)` — reads Redis key `ai_limit:{userId}:{date}`
   - Returns `{ used, limit: 10, remaining }`

4. **Refactored buildMessages** (`ai-tutor.service.ts`)
   - Extracted `buildMessages()` private helper (shared by both ask methods)

5. **pgvector migration** (`20260323000000_add_pgvector_embedding/migration.sql`)
   - `CREATE EXTENSION IF NOT EXISTS vector`
   - `ALTER TABLE course_chunks ADD COLUMN IF NOT EXISTS embedding vector(384)`

**SSE Protocol:**
```
data: {"type":"start","sessionId":"clx..."}
data: {"type":"token","content":"Hello"}
data: {"type":"token","content":" world"}
data: {"type":"done","messageId":"clx...","sessionId":"clx..."}
```

---

## Shared Layer

### `packages/shared-api-client/src/client.ts` — MODIFIED
- Added `streamFetch(path, body)` method — raw `fetch` with auth headers, returns `Response` (no JSON parsing)

### `packages/shared-hooks/src/services/qna.service.ts` — EXTENDED
Added: `createQuestion`, `updateQuestion`, `deleteQuestion`, `findSimilar`, `deleteAnswer`, `voteAnswer`
Types: `CreateQuestionData`, `UpdateQuestionData`
Uses `apiClient.del()` (not `delete`) for consistency.

### `packages/shared-hooks/src/services/ai-tutor.service.ts` — NEW
Methods: `getQuota`, `getSessions`, `getSessionMessages`, `ask`, `askStream`
`askStream` uses `apiClient.streamFetch()` for SSE.

### `packages/shared-hooks/src/queries/use-qna.ts` — EXTENDED
Added hooks: `useSimilarQuestions`, `useCreateQuestion`, `useUpdateQuestion`, `useDeleteQuestion`, `useDeleteAnswer`, `useVoteAnswer`

### `packages/shared-hooks/src/queries/use-ai-tutor.ts` — NEW
Hooks: `useAiQuota`, `useAiSessions`, `useSessionMessages`
Note: streaming is NOT a TanStack Query hook — managed by ChatPanel component state.

### `packages/shared-hooks/src/index.ts` — EXTENDED
Exports all new services, hooks, and types.

---

## Frontend — File Structure

```
components/
├── qna/
│   ├── question-card.tsx      # Question summary card (link, resolved badge, answer count)
│   ├── answer-card.tsx        # Answer with vote, best-answer, mark/delete actions
│   ├── answer-form.tsx        # Textarea + code snippet + submit
│   ├── vote-buttons.tsx       # Up/down arrows with optimistic update
│   └── code-block.tsx         # Code display with language badge + copy button
├── ai-tutor/
│   ├── session-sidebar.tsx    # Course selector + session list + usage + disclaimer
│   ├── chat-panel.tsx         # Header + messages + streaming + input
│   ├── chat-message.tsx       # Single message bubble (user right / AI left)
│   ├── markdown-renderer.tsx  # react-markdown + remark-gfm + code copy
│   └── streaming-indicator.tsx # Animated "Thinking..." dots

app/[locale]/
├── (main)/qna/
│   ├── page.tsx               # Q&A list (131 lines)
│   ├── ask/page.tsx           # Ask question form (225 lines)
│   └── [questionId]/page.tsx  # Question detail (216 lines)
├── (fullscreen)/
│   ├── layout.tsx             # Navbar only, no footer, h-screen overflow-hidden
│   └── ai-tutor/page.tsx      # AI Tutor (172 lines)
```

---

## Frontend Pages

### Q&A List (`/qna`) — 131 lines
- `useQuestions(params)` with debounced search (500ms)
- Tabs: Recent | Unanswered (maps to `status` param)
- `QuestionCard` component with resolved badge, answer count badge
- Pagination (prev/next)

### Ask Question (`/qna/ask`) — 225 lines
- Form: title (10-200), content (20-5000), courseId (from `useMyLearning()`), code snippet (collapsible)
- `useSimilarQuestions(debouncedTitle)` — shows when title ≥ 10 chars
- `useCreateQuestion()` → redirect to `/qna/${newId}`

### Question Detail (`/qna/[questionId]`) — 216 lines
- `useQuestionDetail(questionId)` — includes answers with `userVote`
- `AnswerCard` — vote buttons (initialized from `answer.userVote`), mark best, delete
- `AnswerForm` — textarea + code snippet, min 1 char
- `ConfirmDialog` for delete question/answer
- Sidebar: related questions (placeholder)

### AI Tutor (`/ai-tutor`) — 172 lines
- Route group `(fullscreen)` — no footer, no mobile nav, full height
- Two-column: `SessionSidebar` (sm:w-72) + `ChatPanel` (flex-1)
- Mobile: toggle between sidebar and chat
- State managed in page, passed as props to components

---

## Key Technical Decisions

### 1. Unique View Tracking (Redis SET)
- `SADD qview:{questionId} userId` — returns 1 only on first view
- Prevents F5 spam and vote-triggered re-fetch from inflating views
- TTL 30 days auto-cleanup

### 2. userVote from Backend
- `findById` conditionally includes `votes` relation for authenticated users
- Frontend initializes `localVote` from `answer.userVote` — consistent after F5
- Optimistic update with rollback on error

### 3. Quota from Backend API (not localStorage)
- `GET /ai/tutor/quota` reads Redis `ai_limit:{userId}:{date}`
- Accurate across browsers/devices, per-user, can't be manipulated
- `useAiQuota()` hook, invalidated after each ask via `['ai-tutor']` key

### 4. SSE Streaming with fetch API
- `apiClient.streamFetch()` — raw fetch with auth, returns Response
- `ReadableStream` reader + TextDecoder + line buffer for SSE parsing
- Thinking dots shown until **first token** (not `start` event) for visible feedback

### 5. Route Group `(fullscreen)`
- AI Tutor needs h-screen layout without footer
- `overflow-hidden` on main prevents page scroll
- Auto-scroll uses `container.scrollTop = scrollHeight` (not `scrollIntoView` which scrolls the whole page)
- `shouldScrollRef` — only scroll on user send, not on session load

### 6. Dev Streaming Delay
- `if (isDev) await new Promise(r => setTimeout(r, 30))` per token
- Groq API too fast in dev → streaming effect invisible without delay
- Production unaffected (`NODE_ENV=production`)

---

## npm Dependencies Added

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `react-markdown` | student-portal | Markdown → React (AI responses) |
| `remark-gfm` | student-portal | GitHub Flavored Markdown support |

---

## i18n Keys Updated

**`qna`**: Added `resolved`, `noQuestions`, `prev`, `next`
**`askQuestion`**: Replaced tags with code snippet keys, added `cancel`, `similarQuestions`, validation messages
**`questionDetail`**: Added `markBest`, `addCode`, `codePlaceholder`, `copy`, `copied`, `deleteQuestion`, `deleteAnswer`, `confirmDelete`, `backToQna`, `loginToAnswer`, `notFound`, `noRelated`, `answerMinLength`
**`aiTutor`**: Added `selectCourse`, `selectCourseHint`, `noSessions`, `noCourses`, `messageCount`, `thinking`, `disclaimer`, `usageLimitReached`, `errors.*` (5 error codes)

---

## Navbar Changes

- Added Q&A icon (MessageSquare) and AI Tutor icon (Bot) to desktop navbar (authenticated only, hidden on mobile)
- Added `/ai-tutor` to mobile hamburger menu links

---

## Quality Checklist

- [x] All user-facing strings via `useTranslations()` (vi + en)
- [x] No hardcoded colors — design tokens only
- [x] Dark mode correct
- [x] Mobile responsive (sidebar toggle on AI Tutor)
- [x] Loading states (Loader2 spinner)
- [x] Empty states (no questions, no sessions, no courses)
- [x] Optimistic updates for vote (with rollback)
- [x] Streaming indicator (thinking dots until first token)
- [x] Auto-scroll on new messages (shouldScrollRef pattern)
- [x] Code blocks with copy button
- [x] Confirm dialog for delete actions
- [x] Auth checks (answer form hidden for unauthenticated)
- [x] No `any` types
- [x] Named exports (except page default exports)
- [x] Components split — no page > 230 lines

# Phase 5.10 — Q&A, NOTIFICATIONS, AI & RECOMMENDATIONS

> Q&A Forum, Notification system (REST + WebSocket), AI Tutor (Groq + RAG + Embeddings), Recommendation engine.
> Tham chiếu: `docs/phase3-backend/02-api-endpoints.md`, `docs/phase3-backend/03-realtime-and-services.md`
> Prisma models: Question, Answer, Vote, Notification, AiChatSession, AiChatMessage, CourseChunk, CourseSimilarity

---

## Sub-phases

Phase 5.10 chia thành 4 sub-phases vì phạm vi rất lớn:

| Sub-phase | Scope | Files | Tests |
|-----------|-------|-------|-------|
| **5.10a** | Q&A Forum (Question, Answer, Vote) | ~10 | ~30 |
| **5.10b** | Notifications (CRUD + WebSocket Gateway) | ~6 | ~15 |
| **5.10c** | AI Tutor (Groq + Embeddings + RAG) | ~8 | ~20 |
| **5.10d** | Recommendations (3 algorithms + context-aware) | ~6 | ~15 |

Chi tiết từng sub-phase trong file riêng: `implementation-5.10a.md`, `implementation-5.10b.md`, etc.

---

## Tổng quan Endpoints

### Q&A Forum (10 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/questions | Authenticated | Tạo câu hỏi |
| GET | /api/questions | Authenticated | List questions (filter, search, paginated) |
| GET | /api/questions/similar | Authenticated | Gợi ý câu hỏi tương tự |
| GET | /api/questions/:id | Public | Chi tiết question + answers |
| PUT | /api/questions/:id | Owner | Sửa question |
| DELETE | /api/questions/:id | Owner | Xóa question |
| POST | /api/questions/:id/answers | Authenticated | Post answer |
| PUT | /api/questions/:id/best-answer | Owner/Instructor | Mark best answer |
| DELETE | /api/answers/:id | Owner | Xóa answer |
| POST | /api/answers/:id/vote | Authenticated | Upvote/downvote |

### Notifications (4 endpoints + WebSocket)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/notifications | Authenticated | List notifications (filter read/unread) |
| GET | /api/notifications/unread-count | Authenticated | Unread badge count |
| PUT | /api/notifications/:id/read | Authenticated | Mark single as read |
| PUT | /api/notifications/read-all | Authenticated | Mark all as read |

WebSocket namespace `/notifications`:
- Server → Client: `notification` (push new), `unread_count` (update badge), `order_status_changed` (payment)

### AI Tutor (3 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/ai/tutor/ask | Authenticated (enrolled) | Ask AI question (RAG) |
| GET | /api/ai/tutor/sessions | Authenticated | List chat sessions |
| GET | /api/ai/tutor/sessions/:id/messages | Authenticated (owner) | Session message history |

### Recommendations (2 endpoints)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/recommendations | Public (personalized if auth) | Course recommendations |
| GET | /api/recommendations/chapters | Authenticated | Smart chapter suggestions |

**Tổng: 19 REST endpoints + 3 WebSocket events**

---

## Module Structure

```
src/modules/
├── qna/                          # Sub-phase 5.10a
│   ├── qna.module.ts
│   ├── questions/
│   │   ├── questions.controller.ts
│   │   ├── questions.service.ts
│   │   └── questions.service.spec.ts
│   ├── answers/
│   │   ├── answers.controller.ts
│   │   ├── answers.service.ts
│   │   └── answers.service.spec.ts
│   └── dto/
│       ├── create-question.dto.ts
│       ├── update-question.dto.ts
│       ├── query-questions.dto.ts
│       ├── create-answer.dto.ts
│       └── vote.dto.ts
│
├── notifications/                # Sub-phase 5.10b
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   ├── notifications.service.spec.ts
│   ├── notifications.controller.ts
│   ├── notifications.gateway.ts
│   └── dto/
│       └── query-notifications.dto.ts
│
├── ai-tutor/                     # Sub-phase 5.10c
│   ├── ai-tutor.module.ts
│   ├── ai-tutor.service.ts
│   ├── ai-tutor.service.spec.ts
│   ├── ai-tutor.controller.ts
│   ├── embeddings/
│   │   ├── embeddings.service.ts
│   │   └── embeddings.service.spec.ts
│   └── dto/
│       └── ask-question.dto.ts
│
└── recommendations/              # Sub-phase 5.10d
    ├── recommendations.module.ts
    ├── recommendations.service.ts
    ├── recommendations.service.spec.ts
    ├── recommendations.controller.ts
    ├── algorithms/
    │   ├── content-based.service.ts
    │   ├── collaborative.service.ts
    │   └── popularity.service.ts
    └── dto/
        └── query-recommendations.dto.ts
```

---

## Key Design Decisions

### 1. Question.tagId — Single tag (not array)

Schema has `tagId String?` (1 tag per question). API doc showed `tags: ["react", "hooks"]` (array). Giữ single `tagId` vì:
- Already migrated, changing requires migration + data migration
- 1 primary tag per question đủ cho MVP (Stack Overflow cũng có "primary tag")
- Tag relation qua `Tag` model — không phải free-text string

### 2. Vote system — 3-state toggle

```
API doc says value: 0 = remove vote
Plan implementation uses toggle + change logic:
  - Same value as existing → REMOVE vote (decrement)
  - Different value → CHANGE vote (swing by 2x)
  - No existing → CREATE vote (increment)

Response: { voteCount: number, userVote: number | null }
```

### 3. AI Tutor — Non-streaming first

API doc specifies SSE streaming. For Phase 5.10c:
- Implement non-streaming response first (return full JSON)
- Add streaming in a follow-up optimization
- Groq SDK supports both `stream: true/false`

### 4. Embeddings — Lazy loading

```
Model loading strategy:
  - onModuleInit → load model (~50MB download first time)
  - Lazy: load on first use (faster startup, slower first query)
  - Choose lazy for dev, onModuleInit for production
```

### 5. Notifications — Gateway integration

```
NotificationsService.create() flow:
  1. Save notification to DB
  2. Call gateway.pushToUser() to push via WebSocket
  3. Call gateway.pushUnreadCount() to update badge

Gateway injected into Service (not the other way around)
```

### 6. Recommendations — Cron-computed similarity

```
Similarity scores pre-computed by cron job (Phase 5.11):
  - Content-based: Cosine similarity on tag vectors
  - Collaborative: Jaccard similarity on enrollment sets
  - Hybrid: Weighted average (CB 0.4 + CF 0.4 + Pop 0.2)

getRecommendations reads from CourseSimilarity table (fast)
computeSimilarity writes to CourseSimilarity table (slow, cron)
```

---

## Dependencies

### Already installed
- `groq-sdk` ✅
- `socket.io` + `@nestjs/platform-socket.io` ✅
- `@nestjs/jwt` ✅

### Need to install
```bash
cd apps/api
npm install @huggingface/transformers
```

### No schema changes needed
All 8 models already exist from Phase 5.2 migration.

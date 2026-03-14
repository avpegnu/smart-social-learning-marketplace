# Phase 3: Backend API Design — Smart Social Learning Marketplace

## Thống kê

| Metric                   | Value                             |
| ------------------------ | --------------------------------- |
| **API Endpoints**        | ~103                              |
| **NestJS Modules**       | 15 (feature) + 5 (infrastructure) |
| **WebSocket Namespaces** | 2 (chat, notifications)           |
| **Cron Jobs**            | 9 scheduled tasks                 |
| **Queue Processors**     | 3 (email, notification, feed)     |
| **External Services**    | 8 integrations                    |
| **Framework**            | NestJS (TypeScript)               |

## Tài liệu

| #   | File                                                       | Nội dung                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [01-backend-architecture.md](01-backend-architecture.md)   | Kiến trúc tổng quan, folder structure, request pipeline, auth/guard/interceptor, rate limiting, validation, error handling, Swagger config, env vars, module dependencies                                                    |
| 2   | [02-api-endpoints.md](02-api-endpoints.md)                 | Chi tiết ~103 REST API endpoints cho 13 module: request/response format, DTOs, business logic, access control, edge cases                                                                                                    |
| 3   | [03-realtime-and-services.md](03-realtime-and-services.md) | WebSocket gateway (chat + notification), Bull queue system, 9 cron jobs implementation, external service integration (Cloudinary, Gmail SMTP (Nodemailer), Groq, pgvector, Redis), recommendation engine, embedding pipeline |

## Module Map

| Module            | Endpoints | Mô tả                                                               |
| ----------------- | --------- | ------------------------------------------------------------------- |
| Auth              | 9         | Register, Login, JWT Refresh, Google OAuth, Cross-portal OTT        |
| Users             | 8         | Profile CRUD, Follow/Unfollow, Notification preferences             |
| Courses (public)  | 5         | Search + Filter, Course detail, Reviews, Course player              |
| Course Management | 15        | Instructor CRUD: Course/Section/Chapter/Lesson/Quiz                 |
| Instructor        | 10        | Dashboard, Withdrawals, Coupons, Instructor applications            |
| Ecommerce         | 10        | Cart, Orders, SePay webhook, Wishlists                              |
| Learning          | 8         | Video progress tracking, Quiz submit, Certificates, Placement tests |
| Social            | 15        | Feed (fanout), Posts, Chat (WebSocket), Groups, Bookmarks           |
| Q&A Forum         | 8         | Questions, Answers, Votes, Best answer, Similar suggestions         |
| Notifications     | 4         | Multi-channel (in-app + email + WebSocket push)                     |
| AI Tutor          | 3         | RAG pipeline (Groq + pgvector), Chat sessions                       |
| Recommendations   | 2         | Hybrid algorithm, Smart chapter suggestion                          |
| Admin             | 12        | Approvals, User management, Reports, Analytics, Settings            |

## Key Design Decisions

- **Auth:** JWT (access 15m + refresh 7d rotation) — access in memory, refresh in httpOnly cookie
- **Authorization:** Global JwtAuthGuard + RolesGuard + ownership check in service layer
- **Validation:** class-validator + class-transformer (global ValidationPipe, whitelist + transform)
- **Response format:** `{ data, meta?, message? }` — chuẩn hóa mọi response
- **Error handling:** PrismaExceptionFilter + HttpExceptionFilter — lỗi có context rõ ràng
- **Rate limiting:** ThrottlerModule (global) + Redis-based (per-route precision)
- **WebSocket:** Socket.io — 2 namespaces (chat + notifications), in-memory adapter
- **Queue:** Bull + Upstash Redis — email, notification fan-out, feed fanout-on-write
- **Cron:** @nestjs/schedule — 9 jobs (order expiry, earnings release, analytics, recommendations, ...)
- **Search:** PostgreSQL tsvector + GIN index (raw SQL qua Prisma.$executeRaw)
- **AI:** RAG pipeline — local embeddings (Transformers.js) + pgvector search + Groq stream
- **Payment:** SePay webhook → verify → complete order (ACID transaction)
- **Cache:** Upstash Redis — course list (5m), course detail (30m), ~3,700 cmd/day
- **Uploads:** Cloudinary direct upload (signed) — video auto-transcode 480p/720p

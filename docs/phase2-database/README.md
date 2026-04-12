# Phase 2: Thiết kế Database — Smart Social Learning Marketplace

## Thống kê

| Metric               | Value                      |
| -------------------- | -------------------------- |
| **Models**           | 61                         |
| **Enums**            | 30+                        |
| **Database**         | PostgreSQL 16 + pgvector   |
| **ORM**              | Prisma                     |
| **Ước tính storage** | ~465MB / 500MB (Neon free) |

## Tài liệu

| #   | File                                               | Nội dung                                                                                                                                      |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [01-database-design.md](01-database-design.md)     | Design decisions, ERD diagrams (10 modules), entity summary (61 tables), index strategy, raw SQL migrations, storage estimation, seeding plan |
| 2   | [prisma/schema.prisma](../../prisma/schema.prisma) | Full Prisma schema — 61 models, 30+ enums, comments tiếng Việt chi tiết                                                                       |
| 3   | [prisma/migrations/](../../prisma/migrations/)     | Raw SQL: tsvector search, pgvector embeddings, order expiry, cleanup jobs                                                                     |

## Module Map

| Module              | Entities | Mô tả                                                                    |
| ------------------- | -------- | ------------------------------------------------------------------------ |
| 1. Auth & Users     | 4        | User, RefreshToken, InstructorProfile, InstructorApplication             |
| 2. Course Structure | 12       | Category, Tag, Course, Section, Chapter, Lesson, Media, Quiz, ...        |
| 3. Ecommerce        | 12       | Order, Enrollment, ChapterPurchase, Coupon, Earning, Withdrawal, ...     |
| 4. Learning         | 8        | LessonProgress, QuizAttempt, Certificate, DailyActivity, UserSkill, ...  |
| 5. Social           | 12       | Post, Like, Comment, Follow, Conversation, Message, Group, FeedItem, ... |
| 6. Q&A Forum        | 3        | Question, Answer, Vote                                                   |
| 7. Notifications    | 1        | Notification (multi-channel)                                             |
| 8. AI Features      | 3        | AiChatSession, AiChatMessage, CourseChunk (pgvector)                     |
| 9. Admin            | 4        | Report, CommissionTier, PlatformSetting, AnalyticsSnapshot               |
| 10. Recommendation  | 1        | CourseSimilarity (pre-computed matrix)                                   |

## Key Design Decisions

- **ID**: CUID (sortable, URL-safe, không lộ count)
- **Soft delete**: Chỉ User, Course, Post (3 entities)
- **Denormalized counters**: followerCount, likeCount, avgRating, ... (atomic update)
- **JSON fields**: notificationPreferences, watchedSegments, bankInfo, ... (flexible, ít query)
- **Composite PKs**: Follow, LessonProgress, DailyActivity, CourseTag, CouponCourse
- **Full-text search**: PostgreSQL tsvector + GIN index (không cần Elasticsearch)
- **Vector search**: pgvector + IVFFlat index (cho AI RAG, 384 dimensions)

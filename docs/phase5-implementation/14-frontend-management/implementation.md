# Phase 5.14 — FRONTEND MANAGEMENT PORTAL

> 20+ pages — Instructor dashboard + course management, Admin dashboard + platform management.
> Desktop-only (min 1024px). Tham chiếu: `docs/phase4-frontend/04-management-portal.md`

---

## TỔNG QUAN

Management Portal đã có mock UI (Phase 5.12). Phase này wire tất cả pages với backend API thật,
thêm validation, error handling, loading states, và hoàn thiện UX.

### Hiện trạng (sau Phase 5.12)

- ✅ Layout: Sidebar, Header, Breadcrumb, DesktopGuard
- ✅ Auth Provider, Query Provider (same pattern as student portal)
- ✅ Data display components: StatCard, DataTable, ChartWidget, StatusBadge
- ✅ Theme toggle, Locale switcher
- ✅ Mock data cho tất cả pages
- ✅ i18n: 434 keys (vi + en)
- ❌ Tất cả pages dùng mock data — chưa gọi API
- ❌ Forms không validate, không gọi API
- ❌ Auth chưa wire (login mock, no guards)
- ❌ Sidebar/Header hardcode user info

### Backend Endpoints Available

**Instructor (18 endpoints):**
| Controller | Endpoints |
|-----------|-----------|
| instructor | POST /instructor/applications, GET /instructor/applications/me, GET /instructor/profile, PATCH /instructor/profile, GET /instructor/dashboard |
| course-management | GET/POST/PATCH/DELETE /instructor/courses, POST /:id/submit, PUT /:id/tags |
| sections | POST/PATCH/DELETE /instructor/courses/:courseId/sections, PUT reorder |
| chapters | POST/PATCH/DELETE .../sections/:sectionId/chapters, PUT reorder |
| lessons | POST/PATCH/DELETE .../chapters/:chapterId/lessons, PUT reorder |
| coupons | POST/GET/PATCH/DELETE /instructor/coupons |
| withdrawals | POST/GET /instructor/withdrawals |

**Admin (15 endpoints):**
| Controller | Endpoints |
|-----------|-----------|
| analytics | GET /admin/dashboard, GET /admin/analytics |
| users | GET /admin/users, PATCH /admin/users/:id/status |
| applications | GET/PATCH /admin/applications |
| courses | GET /admin/courses/pending, PATCH /admin/courses/:id/review |
| content | POST/PATCH/DELETE /admin/categories, POST/PATCH/DELETE /admin/tags |
| content | GET/POST/DELETE /admin/commission-tiers, GET/PUT /admin/settings |
| withdrawals | GET/PATCH /admin/withdrawals |

**Shared (used by management):**
| Controller | Endpoints |
|-----------|-----------|
| auth | POST login/logout/refresh |
| categories | GET /categories (public) |
| notifications | GET /notifications, GET unread-count, PUT read-all, PUT :id/read |
| questions | GET /questions (filtered by course), POST answers, PUT best-answer |

### Backend Gaps (cần bổ sung nếu cần)

1. **Admin reports management** — Backend chỉ có `POST /reports` (user submit). Chưa có GET/PATCH cho admin. → Page admin/reports sẽ cần thêm backend endpoints hoặc tạm skip.
2. **Course students list** — Chưa có endpoint riêng cho instructor xem students của course. → Có thể dùng GET /admin/users hoặc thêm endpoint mới.
3. **Admin all courses** — Chỉ có `GET /admin/courses/pending`. Chưa có list all courses. → Admin courses page sẽ focus vào pending review.
4. **Instructor revenue detail** — GET /instructor/dashboard trả stats chung. Chưa có revenue breakdown by course/month. → Revenue page sẽ dùng dashboard stats + orders data.

---

## SUB-PHASES

Phase 5.14 được tách thành 6 sub-phases theo dependency order:

```
5.14a Auth & Navigation (PHẢI xong trước — mọi page cần auth)
  ↓
5.14b Instructor Dashboard & Course List
  ↓
5.14c Course Wizard & Curriculum Editor (phức tạp nhất)
  ↓
5.14d Instructor Finance & Q&A (Revenue, Withdrawals, Coupons, Q&A, Settings)
  ↓
5.14e Admin Dashboard & User Management
  ↓
5.14f Admin Approvals & Operations (Approvals, Categories, Withdrawals, Reports, Settings)
```

### Sub-phase details

| Sub-phase | Pages | API hooks | Complexity |
|-----------|-------|-----------|------------|
| **5.14a** Auth & Navigation | Login, Unauthorized, Layouts (2) | useLogin, useLogout, useNotifications | Low |
| **5.14b** Instructor Dashboard & Courses | Dashboard, Course List | useInstructorDashboard, useInstructorCourses, useDeleteCourse, useSubmitCourse | Medium |
| **5.14c** Course Wizard & Curriculum | Create/Edit Course (4 steps), Curriculum Editor | useCreateCourse, useUpdateCourse, useSections, useChapters, useLessons, useTags | High |
| **5.14d** Instructor Finance & Q&A | Revenue, Withdrawals, Coupons, Q&A, Settings | useWithdrawals, useCoupons, useQuestions, useInstructorProfile | Medium |
| **5.14e** Admin Dashboard & Users | Admin Dashboard, User Management | useAdminDashboard, useAdminAnalytics, useAdminUsers | Medium |
| **5.14f** Admin Approvals & Operations | Approvals (2), Categories, Withdrawals, Reports, Analytics, Settings | useApplications, usePendingCourses, useCategories, useTags, useCommissionTiers, useSettings | Medium |

### Shared API Hooks Strategy

Tất cả API hooks sẽ được tạo trong `packages/shared-hooks/src/api/`:

```
packages/shared-hooks/src/api/
├── use-auth.ts            # ✅ Đã có (Phase 5.13a)
├── use-instructor.ts      # NEW — instructor dashboard, profile, application
├── use-courses.ts         # NEW — course CRUD, sections, chapters, lessons
├── use-coupons.ts         # NEW — coupon CRUD
├── use-withdrawals.ts     # NEW — withdrawal requests
├── use-qna.ts             # NEW — questions, answers, votes
├── use-admin.ts           # NEW — admin dashboard, analytics, users, applications
├── use-admin-content.ts   # NEW — categories, tags, commission-tiers, settings
├── use-admin-courses.ts   # NEW — pending courses, review
├── use-admin-withdrawals.ts # NEW — admin withdrawal management
└── use-notifications.ts   # NEW — notifications (shared between portals)
```

### File chi tiết cho từng sub-phase

- [implementation-5.14a.md](./implementation-5.14a.md) — Auth, Navigation & Shared Hooks
- [implementation-5.14b.md](./implementation-5.14b.md) — Instructor Dashboard & Course List
- [implementation-5.14c.md](./implementation-5.14c.md) — Course Wizard & Curriculum Editor
- [implementation-5.14d.md](./implementation-5.14d.md) — Instructor Finance & Q&A
- [implementation-5.14e.md](./implementation-5.14e.md) — Admin Dashboard & User Management
- [implementation-5.14f.md](./implementation-5.14f.md) — Admin Approvals & Operations

# Phase 5.14 — FRONTEND MANAGEMENT PORTAL

> 20+ pages — Instructor dashboard + course management, Admin dashboard + platform management.
> Desktop-only (min 1024px). Tham chiếu: `docs/phase4-frontend/04-management-portal.md`

---

## Mục lục

- [Step 1: Common Pages](#step-1-common-pages)
- [Step 2: Instructor — Dashboard](#step-2-instructor--dashboard)
- [Step 3: Instructor — Course Management](#step-3-instructor--course-management)
- [Step 4: Instructor — Revenue & Withdrawals](#step-4-instructor--revenue--withdrawals)
- [Step 5: Instructor — Coupons & Q&A](#step-5-instructor--coupons--qa)
- [Step 6: Admin — Dashboard](#step-6-admin--dashboard)
- [Step 7: Admin — User Management](#step-7-admin--user-management)
- [Step 8: Admin — Approvals (Instructors + Courses)](#step-8-admin--approvals-instructors--courses)
- [Step 9: Admin — Content Management](#step-9-admin--content-management)
- [Step 10: Admin — Analytics & Settings](#step-10-admin--analytics--settings)
- [Step 11: Verify](#step-11-verify)

---

## Step 1: Common Pages

### Login — `/(auth)/login/page.tsx`

- Same credentials as student portal
- After login, check role:
  - INSTRUCTOR → redirect to `/instructor/dashboard`
  - ADMIN → redirect to `/admin/dashboard`
  - STUDENT → show unauthorized message

### Desktop Guard

```tsx
// Wrap all management layouts
export default function ManagementLayout({ children }) {
  return (
    <DesktopGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </DesktopGuard>
  );
}
```

Mobile shows: "Vui lòng sử dụng máy tính để truy cập trang quản lý"

---

## Step 2: Instructor — Dashboard

### Route: `/instructor/dashboard`

Cards:

- Total revenue (current month + growth %)
- Total students
- Total courses (published/draft)
- Recent orders (table with 10 rows)

Charts (Recharts):

- Revenue by month (bar chart)
- Enrollment trend (line chart)

Data: `GET /api/instructor/dashboard`

---

## Step 3: Instructor — Course Management

### My Courses — `/instructor/courses`

- Course list table (DataTable with sorting, filtering)
- Status badges (DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED)
- Actions: Edit, Delete, Submit for Review
- Create new course button

### Create Course (Wizard) — `/instructor/courses/new`

Multi-step form:

1. **Basics** — Title, description, category, level, language, thumbnail
2. **Curriculum** — Drag-drop sections/chapters/lessons
3. **Content** — Upload videos, write text, create quizzes per lesson
4. **Pricing** — Course price, chapter prices (optional)
5. **Review & Submit** — Preview + submit for review

### Curriculum Editor — `/instructor/courses/[courseId]/curriculum`

- Drag-and-drop reordering (sections, chapters, lessons)
- Inline editing of titles
- Add/remove sections, chapters, lessons
- Lesson type selector (Video, Text, Quiz)
- For Quiz: inline question + option editor

### Edit Course — `/instructor/courses/[courseId]/edit`

- Same wizard as Create, pre-filled with existing data
- Can edit any step independently

### Course Students — `/instructor/courses/[courseId]/students`

- Student list with enrollment date, progress
- Contact student (open chat)

---

## Step 4: Instructor — Revenue & Withdrawals

### Revenue Dashboard — `/instructor/revenue`

- Available balance
- Pending earnings (< 7 days)
- Withdrawal history (table)
- Revenue chart by month
- Commission breakdown

### Withdrawal Request — `/instructor/revenue/withdraw`

- Enter amount
- Bank info form (bank name, account number, account name)
- Confirm + submit

### Withdrawal History — `/instructor/withdrawals`

- Table: amount, status, date, review note
- Status badges (PENDING, PROCESSING, COMPLETED, REJECTED)

---

## Step 5: Instructor — Coupons & Q&A

### Coupons — `/instructor/coupons`

- Coupon list table
- Create coupon form (code, type, value, dates, usage limit, applicable courses)
- Usage statistics per coupon

### Q&A — `/instructor/qa`

- Questions from students (grouped by course)
- Answer directly or mark best answer

### Settings — `/instructor/settings`

- Profile info (headline, bio, expertise, qualifications, social links)
- Bank info for withdrawals
- Notification preferences

---

## Step 6: Admin — Dashboard

### Route: `/admin/dashboard`

Cards:

- Total users (with growth)
- Total courses (published)
- Total revenue (current month)
- Today's orders

Charts:

- Daily Active Users (line chart, 30 days)
- Revenue trend (bar chart, 12 months)
- Enrollment trend (line chart)

Data: `GET /api/admin/dashboard` + `GET /api/admin/analytics`

---

## Step 7: Admin — User Management

### Users — `/admin/users`

- DataTable with columns: Name, Email, Role, Status, Created
- Filters: role, status, search
- Actions: Suspend, Activate, View profile
- Inline role display (badge)

---

## Step 8: Admin — Approvals (Instructors + Courses)

### Instructor Applications — `/admin/instructor-applications`

- Pending applications table
- Click to expand: expertise, experience, motivation, CV link, certificates
- Approve / Reject buttons with optional review note

### Course Reviews — `/admin/courses/pending`

- Pending courses list
- Click to preview course (read-only course detail)
- Approve / Reject with feedback

---

## Step 9: Admin — Content Management

### Categories — `/admin/categories`

- CRUD table with drag-drop reordering
- Parent/child relationship display
- Course count per category

### Tags — `/admin/tags`

- CRUD table
- Course count per tag
- Search/filter

### Reports — `/admin/reports`

- Moderation queue table
- Report details: reporter, target (user/course/post), reason
- Actions: Take Action / Dismiss with note

### Withdrawals — `/admin/withdrawals`

- Pending withdrawal requests
- Instructor info + bank info
- Approve (mark as completed) / Reject with note

### Commission Tiers — `/admin/commission-tiers`

- Table: min revenue, rate
- CRUD operations

### Platform Settings — `/admin/settings`

- Key-value editor
- Settings like: min withdrawal, order expiry, AI daily limit, etc.

---

## Step 10: Admin — Analytics & Settings

### Analytics — `/admin/analytics`

- Date range picker
- Charts: DAU, revenue, enrollments, new courses
- Data from `GET /api/admin/analytics?type=DAILY_USERS&from=...&to=...`
- Export to CSV (client-side)

---

## Step 11: Verify

### Checklist

- [ ] Desktop-only guard works (shows message on mobile)
- [ ] Login redirects based on role
- [ ] Instructor dashboard shows correct stats
- [ ] Course CRUD works (create, edit, delete)
- [ ] Curriculum editor: drag-drop reorder
- [ ] Quiz editor: create questions with options
- [ ] Revenue dashboard shows earnings + chart
- [ ] Withdrawal request + history works
- [ ] Coupon CRUD works
- [ ] Admin dashboard shows platform stats
- [ ] User management: list, filter, suspend/activate
- [ ] Instructor application review: approve/reject + role change
- [ ] Course review: approve/reject
- [ ] Category/Tag CRUD works
- [ ] Report moderation works
- [ ] Analytics charts render correctly
- [ ] All pages use i18n
- [ ] Dark mode works on all pages

# Phase 7.3 — Admin Analytics: 3 Bugs + Aggregation

> Tài liệu mô tả 3 bugs nghiêm trọng trong admin analytics page và cách fix proper với backend aggregation.

---

## Bối cảnh

User mở trang `/admin/analytics`, thấy:

1. **Tất cả stats cards (Total Users, Total Courses, Total Revenue, New Users This Week) đều hiển thị `0`**
2. **Tất cả 4 charts đều "No data yet"**
3. Sau khi seed lại, tiếp tục test các filter range:
4. **Last 3 months và Last 12 months hiển thị data giống hệt nhau** — chỉ ~30 ngày data lặp lại

3 vấn đề tách biệt nhưng liên quan với nhau.

---

## Tổng quan thay đổi

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Frontend access sai data path → stats hiển thị 0 | Critical | Sửa accessor để unwrap `{ data: ... }` |
| 2 | Cron lưu data shape khác chart expect | High | Đồng bộ shape giữa cron, seed, chart |
| 3 | Range filter không khác nhau khi DB thiếu data | High | Backend aggregation + extend seed |

---

## Bug #1: Frontend data accessor sai

### Vấn đề

API client wrap mọi response trong format chuẩn:

```typescript
interface ApiResponse<T> {
  data: T;
  meta?: { page, limit, total, totalPages };
}
```

Tức là:
- `GET /admin/dashboard` → `{ data: { overview: {...}, pendingApprovals: {...} } }`
- `GET /admin/analytics?type=DAILY_USERS&from=...&to=...` → `{ data: AnalyticsSnapshot[] }`

Nhưng [analytics/page.tsx](apps/management-portal/src/app/[locale]/admin/analytics/page.tsx) trước fix access **trực tiếp** không unwrap:

```tsx
// ❌ SAI: dashboard là { data: {...} }, không phải { overview: ... }
const dashboardData = dashboard as { overview?: ... };
const overview = dashboardData?.overview;  // → undefined → fallback 0

// ❌ SAI: usersQuery.data là { data: [...] }, không phải [...]
const usersData = transformSnapshots(usersQuery.data as AnalyticsSnapshot[]);
// → snapshots.map(...) trên { data: [...] } → "is not a function" hoặc undefined
```

### Fix

Tạo helper `unwrapSnapshots()` xử lý cả 2 shape (đề phòng):

```tsx
interface ApiWrapper<T> {
  data: T;
}

function unwrapSnapshots(
  response: ApiWrapper<AnalyticsSnapshot[]> | AnalyticsSnapshot[] | undefined,
): AnalyticsSnapshot[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  return [];
}
```

Dashboard accessor:

```tsx
const dashboardData = dashboard as
  | { data?: { overview?: Record<string, number>; ... } }
  | undefined;
const overview = dashboardData?.data?.overview;  // ✅ ĐÚNG
```

### Tại sao bug này tồn tại

Trong codebase, một số chỗ unwrap đúng (`data?.data`) một số chỗ không. Có thể do:
- Code generated bởi AI hoặc copy-paste từ nhiều nguồn
- Lack of TypeScript type narrowing — cast `as` khiến TS không catch được

Bài học: API client nên có generic types tốt hơn để TS catch được lỗi unwrap.

---

## Bug #2: Cron data shape mismatch

### Vấn đề

Ngay cả khi fix bug #1, charts vẫn không vẽ được vì **data shape của cron job khác với chart consumer expect**.

#### Cron job lưu (trước fix)

[cron.service.ts:computeAnalyticsSnapshot](apps/api/src/modules/jobs/cron/cron.service.ts):

```typescript
{ type: 'DAILY_USERS',       data: { count: users } }
{ type: 'DAILY_REVENUE',     data: { amount: revenue } }
{ type: 'DAILY_ENROLLMENTS', data: { count: enrollments } }
{ type: 'DAILY_COURSES',     data: { count: courses } }
```

#### Chart expect (đã có sẵn trong frontend)

```tsx
<ChartWidget
  title={t('userRegistrations')}
  dataKeys={[
    { key: 'students', ... },
    { key: 'instructors', ... },   // ← cần 2 keys split
  ]}
/>

<ChartWidget
  title={t('revenueTrends')}
  dataKeys={[{ key: 'revenue', ... }]}   // ← key 'revenue' không phải 'amount'
/>
```

Mismatch trong 2 type:
- `DAILY_USERS`: cron lưu `{ count }` nhưng chart cần `{ students, instructors }` (2 lines)
- `DAILY_REVENUE`: cron lưu `{ amount }` nhưng chart cần `{ revenue }`

Còn `DAILY_ENROLLMENTS` và `DAILY_COURSES` thì khớp (đều `{ count }`).

#### Seed file (line 1509-1517) lại đúng shape mà chart expect

```typescript
{ type: 'DAILY_USERS',       data: { students: ..., instructors: ... } }
{ type: 'DAILY_REVENUE',     data: { revenue: ... } }
{ type: 'DAILY_ENROLLMENTS', data: { count: ... } }
{ type: 'DAILY_COURSES',     data: { count: ... } }
```

→ Seed và chart consistent với nhau. **Chỉ có cron là sai.** Có vẻ cron và seed được viết bởi 2 lần khác nhau, không sync.

### Fix

[cron.service.ts](apps/api/src/modules/jobs/cron/cron.service.ts) — sửa cron để match seed/chart:

```typescript
// Split user count by role
const [students, instructors, revenue, enrollments, courses] = await Promise.all([
  this.prisma.user.count({
    where: { createdAt: dateRange, deletedAt: null, role: 'STUDENT' },
  }),
  this.prisma.user.count({
    where: { createdAt: dateRange, deletedAt: null, role: 'INSTRUCTOR' },
  }),
  // ... revenue, enrollments, courses
]);

const snapshots = [
  { type: 'DAILY_USERS',       data: { students, instructors } },         // ✅
  { type: 'DAILY_REVENUE',     data: { revenue: revenue._sum.finalAmount || 0 } },  // ✅
  { type: 'DAILY_ENROLLMENTS', data: { count: enrollments } },
  { type: 'DAILY_COURSES',     data: { count: courses } },
];
```

Thêm comment trong code để future devs không làm sai lại:

```typescript
// Data shape must match the chart consumers in the management portal:
// - DAILY_USERS:       { students, instructors }
// - DAILY_REVENUE:     { revenue }
// - DAILY_ENROLLMENTS: { count }
// - DAILY_COURSES:     { count }
```

### Risk

Nếu production đã có snapshots lưu shape cũ (`{ count }`, `{ amount }`):
- Charts sẽ hiển thị data trống cho các ngày cũ đó (vì chart tìm key `students`/`revenue` không thấy)
- Snapshots mới (sau fix) sẽ có shape đúng

**Mitigation**: Không cần migrate data cũ vì tự nhiên sẽ bị weekly/monthly aggregation cover (sau bug #3 fix). Hoặc nếu cần clean, có thể xóa old snapshots với SQL:

```sql
DELETE FROM analytics_snapshots WHERE date < CURRENT_DATE - INTERVAL '7 days';
```

Sau đó cron sẽ tự populate lại shape mới.

---

## Bug #3: Last 3 months ≡ Last 12 months (no aggregation, no data)

### Vấn đề

User report:

> "Sao last 3 month với 12 month lại giống nhau nhỉ? Lại cũng k đúng nữa"

Screenshot cho thấy 2 view khác nhau hiển thị **chính xác cùng 1 tập data** (~30 daily points từ 19/2 đến 20/3).

### Root cause #1: Seed chỉ có 30 ngày data

[seed.ts:1504](apps/api/src/prisma/seed.ts):

```typescript
for (let d = 30; d >= 1; d--) { ... }
```

→ DB chỉ có 30 daily snapshots. Khi:
- Range 7 days: query `[today-7, today]` → trả 7 snapshots
- Range 30 days: query `[today-30, today]` → trả 30 snapshots
- Range 3 months: query `[today-90, today]` → DB chỉ có 30 → trả 30
- Range 12 months: query `[today-365, today]` → DB chỉ có 30 → trả 30

→ 2 range cuối hiển thị giống hệt nhau.

### Root cause #2: Không có aggregation

Kể cả khi production có 365 ngày data thật, chart sẽ **lộn xộn** với 365 data points trên 1 trục x. Cần aggregation:
- ≤ 31 ngày → hiển thị daily (raw)
- 32-92 ngày → aggregate weekly (~13 points)
- > 92 ngày → aggregate monthly (12 points)

### Fix

#### Backend aggregation logic

[admin-analytics.service.ts](apps/api/src/modules/admin/analytics/admin-analytics.service.ts):

```typescript
type Granularity = 'daily' | 'weekly' | 'monthly';

async getAnalytics(type: AnalyticsType, fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  const snapshots = await this.prisma.analyticsSnapshot.findMany({
    where: { type, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });

  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  const granularity: Granularity =
    days <= 31 ? 'daily' : days <= 92 ? 'weekly' : 'monthly';

  if (granularity === 'daily') return snapshots;
  return aggregate(snapshots, granularity);
}
```

#### Aggregation algorithm

```typescript
function bucketKey(date: Date, granularity: Granularity): string {
  if (granularity === 'monthly') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  // Weekly: ISO week starting Monday
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - day + 1); // shift to Monday
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function aggregate(snapshots, granularity) {
  const buckets = new Map<string, Record<string, number>>();
  for (const snapshot of snapshots) {
    const key = bucketKey(new Date(snapshot.date), granularity);
    const bucket = buckets.get(key) ?? {};
    for (const [field, value] of Object.entries(snapshot.data)) {
      if (typeof value === 'number') {
        bucket[field] = (bucket[field] ?? 0) + value;
      }
    }
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .map(([key, data]) => ({ date: bucketStartDate(key, granularity), type, data }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

**Cách hoạt động:**
1. Query tất cả snapshots trong range
2. Tính số ngày range để chọn granularity
3. Nếu daily → return raw
4. Nếu weekly/monthly → group theo bucket key, sum tất cả numeric fields

**Tại sao dùng UTC:** tránh edge case khi server và DB ở timezone khác (vd: ngày 1/1 ở UTC nhưng ngày 31/12 ở local timezone → bucket sai).

**Tại sao ISO week (start Monday):** convention quốc tế, không bị lệch theo locale (Mỹ start Sunday, châu Âu start Monday).

#### Frontend date label adaptive

[analytics/page.tsx](apps/management-portal/src/app/[locale]/admin/analytics/page.tsx):

```tsx
function formatDateLabel(dateStr: string, dateRange: string): string {
  const d = new Date(dateStr);
  // 12 months range → backend aggregates monthly, show MM/YYYY
  if (dateRange === '12months') {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  // Other ranges show day/month
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
```

3 month view vẫn dùng `DD/MM` vì weekly buckets vẫn nằm trong cùng năm, không cần show year.

#### Extend seed range

[seed.ts](apps/api/src/prisma/seed.ts):

```typescript
// Trước
for (let d = 30; d >= 1; d--) { ... }

// Sau
for (let d = 365; d >= 1; d--) { ... }
```

Comment cũng update: `30 days of data` → `365 days of data — exercises all date ranges`.

### Kết quả sau fix

| Range | Data points hiển thị | Format |
|-------|---------------------|--------|
| Last 7 days | 7 daily | DD/MM |
| Last 30 days | 30 daily | DD/MM |
| Last 3 months | ~13 weekly buckets | DD/MM (Monday of week) |
| Last 12 months | 12 monthly buckets | MM/YYYY |

4 range giờ khác nhau rõ rệt. Charts không bao giờ bị quá nhiều data points (max ~31).

---

## Verification

| Check | Status |
|-------|--------|
| Backend tests `npx jest admin-analytics` | ✅ 3 passed |
| Backend tests `npx jest cron` | ✅ 12 passed |
| TypeScript API | ✅ 0 errors |
| TypeScript management-portal | ✅ 0 errors |

Trước khi commit, cần re-seed dev DB để xác minh chart hiển thị đúng cho tất cả range:

```bash
cd apps/api && npx prisma db seed
```

Seed dùng `upsert` nên không destructive với data hiện có (trừ commission tier có 1 `deleteMany`).

---

## Files Changed Summary

| File | Change |
|------|--------|
| `apps/management-portal/src/app/[locale]/admin/analytics/page.tsx` | Fix data accessor + adaptive date format |
| `apps/api/src/modules/admin/analytics/admin-analytics.service.ts` | Add granularity detection + aggregation |
| `apps/api/src/modules/jobs/cron/cron.service.ts` | Fix data shape to match chart consumers |
| `apps/api/src/prisma/seed.ts` | Extend snapshot range from 30 → 365 days |

**Total: 4 files modified, 0 files created.**

---

## Lessons Learned

### 1. API response wrapping cần TS-enforced

Bug #1 xảy ra vì frontend cast `as` thay vì có proper types. Fix dài hạn: API client nên có generic types để TS catch lỗi unwrap:

```typescript
const { data } = useAdminDashboard();
// data should be ApiResponse<DashboardData>, not unknown
data.overview;       // ❌ TS error
data.data.overview;  // ✅ correct
```

### 2. Data shape contract cần document

Bug #2 là classic case của 2 chỗ produce data với shape khác nhau. Cần:
- Comment trong cron mô tả expected shape
- Hoặc tốt hơn: define interface chung cho `AnalyticsSnapshot.data` theo từng type
- Hoặc: shared types package cho cả backend và frontend

### 3. Visualizations cần aggregation cho long ranges

Lesson cho mọi dashboard: nếu cho phép user pick "last year" hoặc dài hơn, **luôn cần aggregation** ở backend hoặc frontend. 365 daily points trên 1 chart là UX disaster.

### 4. Seed data nên cover all ranges

Seed chỉ 30 ngày khiến không thể test các filter dài hơn. Nguyên tắc: seed data nên đủ để **demo tất cả features**, không chỉ "đủ để chạy".

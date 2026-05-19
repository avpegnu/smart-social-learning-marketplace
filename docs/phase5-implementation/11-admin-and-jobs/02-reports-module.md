# 02 — Reports Module: User Submission, Duplicate Detection, Admin Review

> Giải thích chi tiết ReportsModule — module dùng chung giữa user (submit report) và admin (review report).
> Duplicate detection, status machine, và separation of controllers.

---

## 1. TỔNG QUAN

### 1.1 Tại sao tách module riêng?

Reports module phục vụ **2 nhóm users**:
- **Authenticated users** — submit reports (báo cáo nội dung vi phạm)
- **Admins** — review và xử lý reports

```
ReportsModule
├── ReportsController         → POST /api/reports (authenticated)
├── AdminReportsController    → GET/PATCH /api/admin/reports (admin only)
└── ReportsService            → Shared business logic
```

Nếu đặt trong AdminModule, users thường không access được endpoint submit. Nếu đặt trong SocialModule, admin logic bị rải rác. Module riêng = clean separation.

### 1.2 2 Controllers, 1 Service

```typescript
// ReportsModule
@Module({
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
```

**NestJS cho phép 1 module có nhiều controllers.** Mỗi controller đăng ký routes riêng:
- `ReportsController` → `@Controller('reports')` — không cần RolesGuard
- `AdminReportsController` → `@Controller('admin/reports')` + `@Roles('ADMIN')`

Cả 2 inject cùng `ReportsService` → không duplicate logic.

---

## 2. USER SUBMIT — Duplicate Detection

### 2.1 Flow

```
User thấy post spam → Click "Report" → Chọn reason → Submit
  │
  ▼
POST /api/reports
  { targetType: "POST", targetId: "p123", reason: "Spam content" }
  │
  ▼
ReportsService.create()
  ├── 1. Check duplicate: same reporter + same target + PENDING? → 409
  └── 2. Create report record
```

### 2.2 Duplicate Detection

```typescript
const existing = await this.prisma.report.findFirst({
  where: {
    reporterId: userId,
    targetType: dto.targetType as ReportTargetType,
    targetId: dto.targetId,
    status: 'PENDING',
  },
});
if (existing) throw new ConflictException({ code: 'REPORT_ALREADY_EXISTS' });
```

**Tại sao chỉ check PENDING?**
- User A report post X → admin dismisses → User A report lại post X (different violation) → cho phép
- User A report post X (PENDING) → User A report lại post X → block (duplicate)

Status machine: `PENDING → REVIEWED | ACTION_TAKEN | DISMISSED`

Khi admin đã xử lý (không còn PENDING), user có thể report lại nếu phát hiện vi phạm mới.

### 2.3 Report Targets

```typescript
@IsIn(['POST', 'COMMENT', 'USER', 'COURSE', 'QUESTION'])
targetType!: string;
```

5 target types từ Prisma enum `ReportTargetType`:
- **POST** — social feed posts
- **COMMENT** — comments trên posts hoặc questions
- **USER** — user profiles
- **COURSE** — course content
- **QUESTION** — Q&A forum questions

`targetId` là ID của entity bị report. Frontend gửi cả `targetType` + `targetId`, backend không cần verify entity tồn tại (report vẫn valid ngay cả khi target bị xóa).

---

## 3. ADMIN REVIEW — Status Machine

### 3.1 Report Status Flow

```
                    ┌──────────┐
        Submit      │          │
User ──────────────→│ PENDING  │
                    │          │
                    └────┬─────┘
                         │
               Admin reviews
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────────┐
      │ REVIEWED │ │DISMISSED │ │ ACTION_TAKEN │
      │(warning) │ │(no issue)│ │(content del) │
      └──────────┘ └──────────┘ └──────────────┘
```

### 3.2 Review Logic

```typescript
async reviewReport(reportId: string, adminId: string, dto: ReviewReportDto) {
  const report = await this.prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
  if (report.status !== 'PENDING') {
    throw new BadRequestException({ code: 'REPORT_ALREADY_REVIEWED' });
  }

  return this.prisma.report.update({
    where: { id: reportId },
    data: {
      status: dto.status as ReportStatus,
      reviewedById: adminId,
      reviewNote: dto.adminNote,
      reviewedAt: new Date(),
    },
  });
}
```

**Key points:**
- **Double-review prevention** — same pattern as instructor application review
- **Audit trail** — `reviewedById`, `reviewedAt`, `reviewNote` recorded
- Status update chỉ 1 operation → không cần transaction

### 3.3 Query Filters

```typescript
const where: Prisma.ReportWhereInput = {
  ...(query.status && { status: query.status as ReportStatus }),
  ...(query.targetType && { targetType: query.targetType as ReportTargetType }),
};
```

Admin có thể filter reports bằng:
- `?status=PENDING` — chỉ xem chưa xử lý
- `?targetType=POST` — chỉ xem reports về posts
- Không filter → xem tất cả

---

## 4. FILES CREATED

| File | Lines | Mục đích |
|------|-------|----------|
| `reports.module.ts` | 12 | Module with 2 controllers |
| `reports.service.ts` | 90 | User submit + admin review logic |
| `reports.controller.ts` | 25 | POST /api/reports (user) |
| `admin-reports.controller.ts` | 40 | GET/PATCH /api/admin/reports |
| `dto/create-report.dto.ts` | 18 | targetType, targetId, reason |
| `dto/query-reports.dto.ts` | 14 | status + targetType filters |
| `reports.service.spec.ts` | 95 | 8 unit tests |

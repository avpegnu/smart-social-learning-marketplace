# 04 — Webhook & Enrollment: SePay Verification, Order Completion, Commission, và Free Enrollment

> Giải thích WebhooksService — SePay webhook security, order completion transaction,
> enrollment creation (FULL/PARTIAL), earning với commission tier, và EnrollmentsService.

---

## 1. SEPAY WEBHOOK — SECURITY

### 1.1 Authentication via Authorization Header

SePay gửi API key trong header `Authorization` với format: `"Apikey <key>"`.

```typescript
// Controller — đọc Authorization header
@Public()   // Bypass JwtAuthGuard
@Post('sepay')
async handleSepay(
  @Headers('authorization') authorization: string,
  @Body() payload: SepayWebhookDto,
) {
  return this.webhooksService.handleSepayWebhook(authorization, payload);
}

// Service — parse "Apikey xxx" → extract key → verify
async handleSepayWebhook(authorization: string, payload: SepayWebhookDto) {
  const webhookSecret = this.config.get('sepay.webhookSecret');
  const apiKey = authorization?.replace(/^Apikey\s+/i, '') ?? '';
  if (apiKey !== webhookSecret) {
    throw new ForbiddenException({ code: 'INVALID_WEBHOOK_KEY' });
  }
}
```

**SePay Authorization format:**
```
Header:  Authorization: Apikey sslm-webhook-2024-secret
Parse:   "Apikey sslm-webhook-2024-secret" → strip "Apikey " → "sslm-webhook-2024-secret"
Compare: "sslm-webhook-2024-secret" === process.env.SEPAY_WEBHOOK_SECRET
```

**Tại sao `@Public()` + manual verification?**
- Webhook từ SePay → không có JWT token.
- `@Public()` bypass global JwtAuthGuard.
- Security qua `Authorization: Apikey` header — shared secret giữa SePay dashboard và backend `.env`.
- ForbiddenException (403) cho SePay biết config sai → cần fix.
- Regex `/^Apikey\s+/i` case-insensitive, xử lý edge cases ("apikey", "APIKEY", extra spaces).

### 1.2 Idempotency — Always Return Success

```typescript
// Mọi case invalid → return { success: true }, KHÔNG throw
if (payload.transferType !== 'in') return { success: true };
if (!orderCodeMatch) return { success: true };
if (!order) return { success: true };
if (payload.transferAmount < order.finalAmount) return { success: true };

// CHỈ throw cho wrong API key (config error cần fix)
```

**Tại sao?**
- SePay retry webhook nếu nhận non-200 response.
- Invalid data (wrong content, order not found) → không nên retry.
- Return 200 + `{ success: true }` → SePay marks as delivered, no retry.
- Exception chỉ cho auth error (403) → SePay biết webhook secret sai.

---

## 2. ORDER CODE EXTRACTION

### 2.1 Regex Parsing

```typescript
// Content chuyển khoản ngân hàng thường có text thừa:
// "SSLM-lq8k9x2f4a chuyen tien mua khoa hoc"
// "FT24015 SSLM-lq8k9x2f4a NGUYEN VAN A"

const orderCodeMatch = payload.content.match(/SSLM-[a-z0-9]+/i);
if (!orderCodeMatch) return { success: true };
const orderCode = orderCodeMatch[0]!;   // "SSLM-lq8k9x2f4a"
```

**Tại sao regex thay vì `content.replace('SSLM ', '')`?**
- Bank content có thể thêm prefix/suffix ngẫu nhiên.
- Regex `SSLM-[a-z0-9]+` match pattern cụ thể, ignore noise.
- Case-insensitive `/i` vì một số ngân hàng uppercase content.

---

## 3. ORDER COMPLETION — TRANSACTION

### 3.1 Transaction Flow (6 operations)

```
completeOrder(orderId, userId, items, paymentRef):
  BEGIN TRANSACTION:
    ① Update order: status=COMPLETED, paidAt=now, paymentRef
    ② For each COURSE item:
       - Upsert enrollment (FULL), upgrade PARTIAL if exists
       - Increment course.totalStudents
    ③ For each CHAPTER item:
       - Upsert chapterPurchase
       - Create PARTIAL enrollment if not exists
    ④ For each item with courseId:
       - Calculate commission rate (tier-based)
       - Create earning (PENDING, availableAt = now + 7 days)
  COMMIT
```

### 3.2 Enrollment Upsert — FULL vs PARTIAL

```typescript
if (item.type === 'COURSE' && item.courseId) {
  await tx.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: item.courseId } },
    update: { type: 'FULL' },     // Upgrade PARTIAL → FULL
    create: { userId, courseId: item.courseId, type: 'FULL' },
  });
}

if (item.type === 'CHAPTER' && item.chapterId) {
  // Chapter purchase record
  await tx.chapterPurchase.upsert({ ... });

  // PARTIAL enrollment nếu chưa có
  if (item.courseId) {
    const existing = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: item.courseId } },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: { userId, courseId: item.courseId, type: 'PARTIAL' },
      });
    }
  }
}
```

**Enrollment types:**
```
FULL    = Mua cả khóa → access tất cả lessons
PARTIAL = Mua lẻ chapters → access chỉ chapters đã mua

Scenario: User mua chapter 1 → PARTIAL enrollment
          Sau đó mua full course → upsert update type: FULL
```

**Tại sao check `existing` trước create cho PARTIAL?**
- User có thể đã có FULL enrollment (mua full trước) → không downgrade.
- `upsert` with `update: {}` cũng work, nhưng explicit check rõ ràng hơn.

---

## 4. COMMISSION TIER — EARNING CALCULATION

### 4.1 Tier-Based Commission

```typescript
private async getCommissionRate(
  instructorId: string,
  tx: Prisma.TransactionClient,
): Promise<number> {
  // Tính total revenue từ earnings đã available + withdrawn
  const totalRevenue = await tx.earning.aggregate({
    where: {
      instructorId,
      status: { in: ['AVAILABLE', 'WITHDRAWN'] },
    },
    _sum: { netAmount: true },
  });
  const revenue = totalRevenue._sum.netAmount ?? 0;

  // Find matching tier (highest minRevenue that's <= revenue)
  const tier = await tx.commissionTier.findFirst({
    where: { minRevenue: { lte: revenue } },
    orderBy: { minRevenue: 'desc' },
  });

  return tier?.rate ?? 0.3;   // Default 30%
}
```

### 4.2 Commission Tiers (from seed data)

```
Tier 1: minRevenue = 0         → rate = 0.30 (30% commission)
Tier 2: minRevenue = 10,000,000 → rate = 0.25 (25%)
Tier 3: minRevenue = 50,000,000 → rate = 0.20 (20%)

Instructor mới (revenue < 10M) → platform giữ 30%
Top instructor (revenue > 50M) → platform giữ 20%
```

### 4.3 Earning Record

```typescript
await tx.earning.create({
  data: {
    instructorId: course.instructorId,
    orderItemId: item.id,
    amount: item.price,                    // Giá gốc
    commissionRate,                         // 0.3, 0.25, or 0.2
    commissionAmount: Math.round(item.price * commissionRate),
    netAmount: item.price - commissionAmount,  // Instructor nhận
    status: 'PENDING',
    availableAt: new Date(Date.now() + EARNING_HOLD_DAYS * 24 * 60 * 60 * 1000),
  },
});
```

**`EARNING_HOLD_DAYS = 7`:**
- Earning tạo với `status: PENDING`, `availableAt: now + 7 days`.
- Cron job (Phase 5.11) chạy daily: `PENDING` + `availableAt <= now` → `AVAILABLE`.
- 7-day hold chống refund fraud: nếu user yêu cầu refund trong 7 ngày → hủy earning.

### 4.4 Prisma.TransactionClient Type

```typescript
// Transaction callback parameter type:
// Prisma.TransactionClient = PrismaClient minus $connect, $disconnect, $transaction, $extends

private async getCommissionRate(
  instructorId: string,
  tx: Prisma.TransactionClient,    // Full type-safe transaction client
): Promise<number> { ... }
```

**Tại sao dùng `Prisma.TransactionClient` thay vì `any`?**
- CLAUDE.md rule: NEVER use `any`.
- `Prisma.TransactionClient` cung cấp autocomplete + type checking cho `tx.earning.aggregate`, `tx.commissionTier.findFirst`.
- Import: `import type { Prisma } from '@prisma/client'` (type-only, no runtime).

---

## 5. ENROLLMENTS SERVICE

### 5.1 Check Enrollment — FULL vs PARTIAL vs Chapter Purchases

```typescript
async checkEnrollment(userId: string, courseId: string) {
  const enrollment = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  // Nếu PARTIAL hoặc chưa enrolled → check chapter purchases
  let purchasedChapterIds: string[] = [];
  if (!enrollment || enrollment.type === 'PARTIAL') {
    const purchases = await this.prisma.chapterPurchase.findMany({
      where: { userId, chapter: { section: { courseId } } },
      select: { chapterId: true },
    });
    purchasedChapterIds = purchases.map((p) => p.chapterId);
  }

  return {
    enrolled: !!enrollment,
    type: enrollment?.type ?? null,
    progress: enrollment?.progress ?? 0,
    purchasedChapterIds,
  };
}
```

**Frontend dùng response này để:**
- Hiển thị "Đã đăng ký" badge trên course card.
- Unlock lessons cho chapters đã mua (PARTIAL).
- Hiển thị progress bar.

### 5.2 Free Course Enrollment

```typescript
async enrollFree(userId: string, courseId: string) {
  // Chỉ courses có price = 0
  const course = await this.prisma.course.findFirst({
    where: { id: courseId, status: 'PUBLISHED', deletedAt: null, price: 0 },
  });
  if (!course) throw new NotFoundException({ code: 'COURSE_NOT_FOUND' });

  // Can't enroll own course
  if (course.instructorId === userId) {
    throw new BadRequestException({ code: 'CANNOT_ENROLL_OWN_COURSE' });
  }

  // Check duplicate
  const existing = await this.prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new ConflictException({ code: 'ALREADY_ENROLLED' });

  // Transaction: create enrollment + increment totalStudents
  return this.prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.create({
      data: { userId, courseId, type: 'FULL' },
    });
    await tx.course.update({
      where: { id: courseId },
      data: { totalStudents: { increment: 1 } },
    });
    return enrollment;
  });
}
```

**Tại sao tách endpoint riêng cho free courses?**
- Free courses KHÔNG cần cart → checkout → payment flow.
- 1-click enrollment: `POST /api/enrollments/free/:courseId`.
- Đơn giản hóa frontend: nút "Đăng ký miễn phí" gọi trực tiếp.

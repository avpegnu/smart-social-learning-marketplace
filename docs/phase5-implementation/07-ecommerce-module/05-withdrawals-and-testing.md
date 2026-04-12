# 05 — Withdrawals & Testing: FIFO Earning Lock, Balance Check, và 54 Unit Tests

> Giải thích WithdrawalsService — pending check, balance validation, FIFO earning lock,
> và testing strategy cho 5 ecommerce modules.

---

## 1. WITHDRAWALS SERVICE

### 1.1 Vai trò

```
WithdrawalsService — 2 methods:

  requestWithdrawal(instructorId, dto) → Tạo withdrawal request + lock earnings
  getWithdrawalHistory(instructorId)   → Paginated list
```

### 1.2 3-Step Validation

```typescript
async requestWithdrawal(instructorId: string, dto: CreateWithdrawalDto) {
  // ① Chỉ 1 pending withdrawal cùng lúc
  const pending = await this.prisma.withdrawal.findFirst({
    where: { instructorId, status: 'PENDING' },
  });
  if (pending) throw new ConflictException({ code: 'WITHDRAWAL_PENDING_EXISTS' });

  // ② Check available balance
  const available = await this.prisma.earning.aggregate({
    where: { instructorId, status: 'AVAILABLE' },
    _sum: { netAmount: true },
  });
  const balance = available._sum.netAmount ?? 0;
  if (dto.amount > balance) throw new BadRequestException({ code: 'INSUFFICIENT_BALANCE' });

  // ③ Transaction: create withdrawal + lock earnings
  return this.prisma.$transaction(async (tx) => { ... });
}
```

### 1.3 FIFO Earning Lock

```typescript
// Trong transaction:
let remaining = dto.amount;
const availableEarnings = await tx.earning.findMany({
  where: { instructorId, status: 'AVAILABLE' },
  orderBy: { createdAt: 'asc' },    // FIFO: oldest first
});

for (const earning of availableEarnings) {
  if (remaining <= 0) break;
  await tx.earning.update({
    where: { id: earning.id },
    data: { status: 'WITHDRAWN' },
  });
  remaining -= earning.netAmount;
}
```

**FIFO (First In, First Out):**
```
Earnings: [100k (Jan), 200k (Feb), 300k (Mar)] = 600k available
Withdrawal: 250k

Lock process:
  100k (Jan) → WITHDRAWN (remaining: 150k)
  200k (Feb) → WITHDRAWN (remaining: -50k, stop)

Result: 300k (Mar) still AVAILABLE
  → 300k - 250k actual = 50k "over-locked" but acceptable
  → Admin approval phase will reconcile
```

**Tại sao mark WITHDRAWN thay vì giảm netAmount?**
- Giữ earning records nguyên vẹn (audit trail).
- Status transition rõ ràng: PENDING → AVAILABLE → WITHDRAWN.
- Không phải tính partial amounts (phức tạp, dễ bug).

### 1.4 BankInfo — JSON Cast

```typescript
await tx.withdrawal.create({
  data: {
    instructorId,
    amount: dto.amount,
    bankInfo: dto.bankInfo as unknown as Prisma.InputJsonValue,
  },
});
```

Same pattern as `InstructorProfile.qualifications` (Phase 5.5) và `Course.learningOutcomes` (Phase 5.6).

### 1.5 Admin Approval — Phase 5.11

```
Phase 5.7 flow:
  Instructor request → Withdrawal(PENDING)
  → Earnings locked (WITHDRAWN)
  → Chờ admin

Phase 5.11 (Admin):
  Admin review → COMPLETED (chuyển tiền) hoặc REJECTED (unlock earnings)
```

---

## 2. DTO — NESTED VALIDATION

### 2.1 BankInfoDto + CreateWithdrawalDto

```typescript
export class BankInfoDto {
  @IsString() bankName!: string;
  @IsString() accountNumber!: string;
  @IsString() accountName!: string;
}

export class CreateWithdrawalDto {
  @IsNumber() @Min(200000)          // Minimum 200,000₫
  amount!: number;

  @ValidateNested()
  @Type(() => BankInfoDto)          // class-transformer cho nested object
  bankInfo!: BankInfoDto;
}
```

**`@ValidateNested()` + `@Type()`:**
- `@ValidateNested()` tells class-validator to validate nested object.
- `@Type(() => BankInfoDto)` tells class-transformer to transform plain JSON → BankInfoDto instance.
- Thiếu `@Type` → nested object không được instantiate → validators không chạy.

---

## 3. TEST OVERVIEW

### 3.1 Phân bố tests

```
Phase 5.7 Tests (54 tests total, 5 files):

  cart/cart.service.spec.ts                → 14 tests
    Cart: getCart, addItem (8 cases), removeItem, clearCart, mergeCart
    Wishlist: addToWishlist, removeFromWishlist

  coupons/coupons.service.spec.ts          → 11 tests
    CRUD: create (valid, invalid %), deactivate, ownership check
    Validation: 6 gates (PERCENTAGE, FIXED, maxDiscount cap, expired, usage, per-user, min order)

  orders/orders.service.spec.ts            → 7 tests
    createOrder (empty cart, success, with coupon, unavailable course)
    findById (owner, not owner)
    getOrderStatus

  orders/webhooks.service.spec.ts          → 6 tests
    handleSepayWebhook (invalid key, non-incoming, no orderCode, order not found,
                        insufficient amount, success flow)

  enrollments/enrollments.service.spec.ts  → 8 tests
    checkEnrollment (FULL, PARTIAL with chapters, not enrolled)
    enrollFree (success, not free, own course, already enrolled)
    getMyLearning

  withdrawals/withdrawals.service.spec.ts  → 5 tests
    requestWithdrawal (pending exists, insufficient, success with FIFO lock)
    getWithdrawalHistory
```

### 3.2 Tổng project

```
Phase 5.3 (Common):       63 tests
Phase 5.4 (Auth):          87 tests
Phase 5.5 (Users):         74 tests
Phase 5.6 (Courses):      151 tests
Phase 5.7 (Ecommerce):    54 tests  ← HIỆN TẠI
─────────────────────────────────────
Total:                    429 tests
```

---

## 4. MOCK STRATEGY — MULTI-MODULE

### 4.1 OrdersService — 3 Dependencies

```typescript
const module = await Test.createTestingModule({
  providers: [
    OrdersService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: ConfigService, useValue: mockConfig },
    { provide: CouponsService, useValue: mockCouponsService },
  ],
}).compile();
```

**ConfigService mock:**
```typescript
const mockConfig = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'sepay.bankId': 'MB',
      'sepay.bankAccountNumber': '0123456789',
      'sepay.bankAccountName': 'PLATFORM',
    };
    return config[key];
  }),
};
```

### 4.2 WebhooksService — Transaction Mock

```typescript
mockPrisma.$transaction.mockImplementation(
  async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      order: { update: jest.fn() },
      enrollment: { upsert: jest.fn() },
      course: {
        findUnique: jest.fn().mockResolvedValue({ instructorId: 'instr-1' }),
        update: jest.fn(),
      },
      earning: {
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
      },
      commissionTier: {
        findFirst: jest.fn().mockResolvedValue({ rate: 0.3 }),
      },
    }),
);
```

**Webhook test cần mock nhiều models trong transaction** vì `completeOrder` gọi nhiều Prisma operations. Mock `tx` object chứa tất cả models cần thiết.

### 4.3 Cart addItem — 8 Test Cases

```
✅ Add full course (price from DB)
✅ Add chapter (price from DB)
❌ Course not found
❌ Buy own course
❌ Already enrolled (FULL)
❌ Chapter not purchasable (no price)
❌ Duplicate in cart
✅ Replace chapters when adding full course
```

**Đây là method phức tạp nhất** (5 validation gates + 2 code paths) → cần nhiều test cases nhất.

---

## 5. COUPON TEST — DATE MOCK

```typescript
const MOCK_COUPON = {
  // ...
  startDate: new Date('2024-01-01'),
  endDate: new Date('2030-12-31'),     // Must be in the future!
  // ...
};
```

**Issue gặp khi test:** ban đầu `endDate: '2025-12-31'` → test fail vì chúng ta đang ở 2026 → coupon đã expired. Fix: dùng `2030-12-31`.

**Alternative:** Mock `Date.now()` — nhưng phức tạp hơn và fragile. Dùng future date đơn giản và explicit hơn.

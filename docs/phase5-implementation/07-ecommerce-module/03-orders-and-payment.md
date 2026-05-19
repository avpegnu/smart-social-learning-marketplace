# 03 — Orders & Payment: Checkout Flow, SePay QR, Order Code, và VietQR

> Giải thích OrdersService — checkout từ cart, coupon re-validation, order code generation,
> SePay QR payment via VietQR API, order history/detail, và status polling.

---

## 1. CHECKOUT FLOW — TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Student Portal)                                  │
│                                                             │
│  Cart Page                Payment Page          Done Page   │
│  ┌───────┐               ┌───────────┐         ┌───────┐  │
│  │Items  │ → Checkout →  │ QR Code   │ → Paid →│ ✅    │  │
│  │Coupon │   POST /orders│ Polling   │  webhook │Receipt│  │
│  │Total  │               │ Timer 15m │         │       │  │
│  └───────┘               └───────────┘         └───────┘  │
└─────────────────────────────────────────────────────────────┘

Backend flow:
  POST /api/orders { couponCode? }
    ① Get cart items
    ② Re-validate (courses still PUBLISHED?)
    ③ Calculate totals + coupon discount
    ④ Transaction: create order + items + coupon usage + clear cart
    ⑤ Generate VietQR payment info
    ⑥ Return { order, payment }
```

---

## 2. ORDER CREATION — TRANSACTION

### 2.1 Tại sao cần re-validate cart items?

```
Giữa lúc addItem (12:00) và checkout (12:30):
  - Course có thể bị instructor unpublish
  - Course có thể bị admin reject
  - Giá có thể thay đổi (nhưng cart lưu giá snapshot)

Re-validation check:
  for (const item of cartItems) {
    if (item.course && item.course.status !== 'PUBLISHED') {
      throw new BadRequestException({ code: 'COURSE_NO_LONGER_AVAILABLE' });
    }
  }
```

### 2.2 Transaction — 4 operations atomically

```typescript
const order = await this.prisma.$transaction(async (tx) => {
  // ① Create order + order items
  const newOrder = await tx.order.create({
    data: {
      userId,
      orderCode,
      totalAmount,
      discountAmount,
      finalAmount,
      expiresAt: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000),
      items: {
        create: cartItems.map((item) => ({
          type: item.chapterId ? 'CHAPTER' : 'COURSE',
          courseId: item.courseId,
          chapterId: item.chapterId,
          price: item.price,
          title: item.course?.title ?? item.chapter?.title ?? '',
        })),
      },
    },
  });

  // ② Record coupon usage + atomic increment
  if (couponId) {
    await tx.couponUsage.create({
      data: { couponId, orderId: newOrder.id, discount: discountAmount },
    });
    await tx.coupon.update({
      where: { id: couponId },
      data: { usageCount: { increment: 1 } },
    });
  }

  // ③ Clear cart
  await tx.cartItem.deleteMany({ where: { userId } });

  return newOrder;
});
```

**Tại sao transaction?**
- Nếu create order thành công nhưng clear cart fail → cart items vẫn còn → user checkout lần nữa → duplicate order.
- Transaction đảm bảo tất cả succeed hoặc tất cả rollback.

### 2.3 Coupon Race Condition

```typescript
// Atomic increment trong transaction
await tx.coupon.update({
  where: { id: couponId },
  data: { usageCount: { increment: 1 } },
});
```

**Prisma `increment` là atomic SQL:**
```sql
UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?
```

2 users checkout cùng lúc với cùng coupon:
- User A: `usageCount: 99 → 100` (within limit)
- User B: `usageCount: 100 → 101` (would exceed, nhưng checked trước transaction)

Potential race: cả 2 đều đọc `usageCount=99` trước transaction → cả 2 pass validation → cả 2 increment.

**Mitigation:** `usageLimit` check trong `validateAndCalculateDiscount` + DB constraint. Nếu cần stricter: dùng `SELECT FOR UPDATE` hoặc Redis distributed lock. Cho MVP, race window cực nhỏ, chấp nhận được.

---

## 3. ORDER CODE — FORMAT VÀ GENERATION

### 3.1 Tại sao cần orderCode?

```
Nội dung chuyển khoản ngân hàng:
  "SSLM-lq8k9x2f4a"     → Ngắn gọn, dễ nhận dạng
  vs
  "clx7a8b9c0d1e2f3g4h"  → CUID quá dài, giống spam

SePay webhook nhận content chuyển khoản → extract orderCode → find order
```

### 3.2 Generation

```typescript
private generateOrderCode(): string {
  const timestamp = Date.now().toString(36);        // Base36: compact
  const random = Math.random().toString(36).substring(2, 6);  // 4 random chars
  return `SSLM-${timestamp}${random}`;
  // Ví dụ: "SSLM-lq8k9x2f4a"
}
```

**Base36:** `0-9` + `a-z` = 36 ký tự. `Date.now()` (13 digits) → base36 (8-9 chars). Compact + readable.

### 3.3 Collision Handling

```
orderCode có @unique constraint trong Prisma.
Nếu collision (P2002) → catch error → regenerate + retry (max 3).
Trong thực tế: timestamp + 4 random chars → collision probability < 1/1,000,000.
```

---

## 4. VIETQR — PAYMENT QR CODE

### 4.1 URL Format

```typescript
private generatePaymentInfo(orderCode: string, amount: number) {
  const bankId = this.config.get('sepay.bankId');           // 'MB'
  const accountNumber = this.config.get('sepay.bankAccountNumber'); // '0123456789'
  const accountName = this.config.get('sepay.bankAccountName');     // 'NGUYEN VAN A'

  return {
    bankId,
    accountNumber,
    accountName,
    amount,
    content: orderCode,
    qrUrl: `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${orderCode}`,
  };
}
```

### 4.2 VietQR API — Tại sao dùng?

```
VietQR: Chuẩn QR thanh toán quốc gia Việt Nam
  → Tất cả ngân hàng VN đều hỗ trợ
  → img.vietqr.io cung cấp API tạo QR image miễn phí
  → URL trực tiếp trả về PNG → frontend <img src={qrUrl}/>

Format: https://img.vietqr.io/image/{bankId}-{account}-{template}.png
  ?amount={amount}
  &addInfo={content}

Templates: compact, compact2, qr_only, print
```

### 4.3 SePay — Vai trò

```
SePay ≠ Payment gateway (không xử lý tiền)
SePay = Bank webhook forwarder

Flow:
  User scan QR → chuyển khoản ngân hàng trực tiếp
  → Ngân hàng nhận tiền → SePay detect transaction
  → SePay gửi webhook POST /api/webhooks/sepay
  → Backend xử lý: confirm order, tạo enrollment

Chi phí: 0₫ (free tier đủ cho graduation thesis)
```

---

## 5. ORDER STATUS POLLING

### 5.1 Tại sao cần polling?

```
Payment page hiển thị QR code:
  → User mở app ngân hàng, scan, chuyển tiền
  → Có thể mất 10-60 giây
  → Frontend cần biết khi nào COMPLETED để redirect

Options:
  A. WebSocket push   → complex, overkill
  B. Polling GET      → simple, works ✅
  C. Server-Sent Events → moderate
```

### 5.2 Implementation

```typescript
@Get(':id/status')
async getOrderStatus(@Param('id') id: string) {
  // Lightweight query — only select status + paidAt
  const order = await this.prisma.order.findUnique({
    where: { id },
    select: { status: true, paidAt: true, userId: true },
  });
  return { status: order.status, paidAt: order.paidAt };
}
```

**Frontend polling pattern:**
```typescript
// React Query with refetchInterval
useQuery({
  queryKey: ['orders', orderId, 'status'],
  queryFn: () => api.get(`/orders/${orderId}/status`),
  refetchInterval: 3000,  // Poll every 3 seconds
  enabled: status === 'PENDING',  // Stop polling when COMPLETED
});
```

---

## 6. ORDER EXPIRY

```typescript
expiresAt: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000),
// ORDER_EXPIRY_MINUTES = 15 (from constants)
```

**PENDING → EXPIRED:**
- Cron job (Phase 5.11) chạy mỗi phút:
  ```sql
  UPDATE orders SET status = 'EXPIRED'
    WHERE status = 'PENDING' AND expires_at < NOW()
  ```
- Phase 5.7 chỉ set `expiresAt`, cron xử lý ở phase sau.
- Frontend hiển thị countdown timer dựa trên `expiresAt`.

---

## 7. CONFIG UPDATE — sepay.bankId

```typescript
// config/sepay.config.ts — THÊM bankId
export const sepayConfig = registerAs('sepay', () => ({
  webhookSecret: process.env.SEPAY_WEBHOOK_SECRET,
  bankId: process.env.BANK_ID ?? 'MB',          // ← MỚI
  bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
  bankAccountName: process.env.BANK_ACCOUNT_NAME,
}));
```

`bankId` cần cho VietQR URL generation. Default `'MB'` (MB Bank).
Thêm `BANK_ID=MB` vào `.env.example`.

# 05 — Module 3: Ecommerce (12 Models)

> Giải thích hệ thống mua bán: giỏ hàng, đơn hàng, thanh toán, mã giảm giá, đánh giá, thu nhập, rút tiền.

---

## 1. TỔNG QUAN FLOW MUA HÀNG

```
Student browse courses
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CartItem   │ ──→ │    Order     │ ──→ │  Enrollment  │
│  (giỏ hàng)  │     │  (đơn hàng)  │     │ (ghi danh)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │   OrderItem   │     ┌──────────────┐
                    │ (chi tiết đơn)│ ──→ │   Earning    │
                    └───────────────┘     │ (thu nhập)   │
                                          └──────┬───────┘
                    ┌───────────────┐             │
                    │  CouponUsage  │     ┌───────┴──────┐
                    │ (sử dụng mã)  │     │  Withdrawal  │
                    └───────────────┘     │  (rút tiền)  │
                                          └──────────────┘
```

---

## 2. CARTITEM — Giỏ hàng

```prisma
model CartItem {
  id        String  @id @default(cuid())
  userId    String  @map("user_id")
  courseId  String? @map("course_id")      // Mua cả khóa
  chapterId String? @map("chapter_id")     // Hoặc mua từng chương
  price     Float                          // Giá tại thời điểm thêm vào giỏ
}
```

### 2.1 Tại sao `courseId` và `chapterId` đều optional?

Mỗi CartItem là **1 trong 2 loại**:

- Mua cả khóa: `courseId = "xxx"`, `chapterId = null`
- Mua từng chương: `courseId = null`, `chapterId = "yyy"`

Validation logic nằm ở backend service — đảm bảo ít nhất 1 trong 2 có giá trị.

### 2.2 Tại sao lưu `price` trong CartItem?

Giá khóa học có thể thay đổi. Lưu `price` tại thời điểm thêm vào giỏ để:

- Hiển thị đúng giá user đã thấy
- So sánh nếu giá thay đổi → thông báo "Giá đã cập nhật"

---

## 3. ORDER & ORDERITEM — Đơn hàng

### 3.1 Order — Đơn hàng tổng

```prisma
model Order {
  id             String      @id @default(cuid())
  userId         String      @map("user_id")
  totalAmount    Float       @map("total_amount")       // Tổng giá gốc
  discountAmount Float       @default(0) @map("discount_amount")  // Số tiền giảm
  finalAmount    Float       @map("final_amount")       // Số tiền thanh toán
  status         OrderStatus @default(PENDING)
  paymentRef     String?     @map("payment_ref")        // Mã giao dịch SePay
  expiresAt      DateTime?   @map("expires_at")         // Hết hạn thanh toán
}
```

**Tính toán:**

```
totalAmount = SUM(orderItem.price)           = 499,000
discountAmount = coupon giảm 20%             = 99,800
finalAmount = totalAmount - discountAmount   = 399,200
```

### 3.2 Order lifecycle

```
PENDING ──────→ COMPLETED ──────→ REFUNDED
    │                                 ↑
    └──────→ EXPIRED          (trong 7 ngày, progress < 10%)
```

- **PENDING**: Chờ thanh toán (QR code hiển thị, hết hạn sau 15 phút)
- **COMPLETED**: SePay webhook xác nhận đã nhận tiền
- **EXPIRED**: Quá 15 phút chưa thanh toán → tự động expire (cron job)
- **REFUNDED**: Admin hoàn tiền (điều kiện: < 7 ngày + tiến độ < 10%)

### 3.3 OrderItem — Chi tiết đơn hàng

```prisma
model OrderItem {
  id        String        @id @default(cuid())
  orderId   String        @map("order_id")
  type      OrderItemType              // COURSE hoặc CHAPTER
  courseId  String?       @map("course_id")
  chapterId String?       @map("chapter_id")
  price     Float                      // Giá tại thời điểm mua
  title     String                     // Tên khóa/chương (snapshot)
}
```

**Tại sao lưu `title` trong OrderItem?**

**Snapshot principle**: Sau khi mua, instructor có thể đổi tên khóa học. OrderItem giữ tên **tại thời điểm mua** — đảm bảo lịch sử mua hàng chính xác.

### 3.4 SePay là gì?

**SePay** là dịch vụ thanh toán qua **chuyển khoản ngân hàng + QR code**:

```
1. Student checkout → Backend tạo Order + paymentRef (mã giao dịch unique)
2. Frontend hiển thị QR code: chuyển khoản đến tài khoản SSLM, nội dung = paymentRef
3. Student quét QR + chuyển tiền
4. SePay webhook → Backend: "Nhận được tiền, mã giao dịch = xxx"
5. Backend match paymentRef → cập nhật Order status = COMPLETED
6. Tạo Enrollment + Earning
```

Lý do chọn SePay: **0đ phí**, hỗ trợ mọi ngân hàng Việt Nam, có webhook API.

---

## 4. ENROLLMENT & CHAPTERPURCHASE — Ghi danh

### 4.1 Enrollment

```prisma
model Enrollment {
  id       String         @id @default(cuid())
  userId   String         @map("user_id")
  courseId String         @map("course_id")
  type     EnrollmentType @default(FULL)    // FULL hoặc PARTIAL
  progress Float          @default(0)       // 0.0 → 1.0 (0% → 100%)

  @@unique([userId, courseId])   // 1 user chỉ enroll 1 lần
}
```

**`type` field:**

- `FULL`: Mua cả khóa → truy cập tất cả lessons
- `PARTIAL`: Mua từng chương → chỉ truy cập chapters đã mua

### 4.2 ChapterPurchase

```prisma
model ChapterPurchase {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  chapterId String @map("chapter_id")

  @@unique([userId, chapterId])   // Không mua trùng
}
```

Khi enrollment type = PARTIAL, cần check `ChapterPurchase` để biết user đã mua chapters nào.

---

## 5. COUPON SYSTEM — Mã giảm giá

### 5.1 Coupon — Mã giảm giá

```prisma
model Coupon {
  id             String     @id @default(cuid())
  code           String     @unique         // "SUMMER2024"
  type           CouponType                 // PERCENTAGE hoặc FIXED_AMOUNT
  value          Float                      // 20 (= 20%) hoặc 50000 (= 50,000đ)
  minOrderAmount Float?                     // Đơn hàng tối thiểu
  maxDiscount    Float?                     // Giảm tối đa (cho PERCENTAGE)
  usageLimit     Int?                       // Số lần sử dụng tối đa
  usageCount     Int        @default(0)     // Đã dùng bao nhiêu lần
  startDate      DateTime                   // Bắt đầu hiệu lực
  endDate        DateTime                   // Hết hiệu lực
  isActive       Boolean    @default(true)  // Admin có thể disable
  instructorId   String                     // Instructor tạo coupon
}
```

**Ví dụ:**

```
Coupon: SUMMER2024
├── type: PERCENTAGE
├── value: 20 (= giảm 20%)
├── minOrderAmount: 200,000đ (đơn tối thiểu)
├── maxDiscount: 100,000đ (giảm tối đa)
├── usageLimit: 100 (tối đa 100 lần dùng)
├── startDate: 2024-06-01
└── endDate: 2024-08-31
```

### 5.2 CouponCourse — Coupon áp dụng cho courses cụ thể

```prisma
model CouponCourse {
  couponId String @map("coupon_id")
  courseId String @map("course_id")

  @@id([couponId, courseId])
}
```

Nếu CouponCourse rỗng → coupon áp dụng cho **tất cả** courses của instructor.
Nếu có records → chỉ áp dụng cho courses cụ thể.

### 5.3 CouponUsage — Lịch sử sử dụng

```prisma
model CouponUsage {
  id       String @id @default(cuid())
  couponId String @map("coupon_id")
  orderId  String @unique @map("order_id")   // 1 order chỉ dùng 1 coupon
  discount Float                              // Số tiền đã giảm
}
```

`orderId @unique` → mỗi đơn hàng chỉ dùng **tối đa 1 coupon**.

---

## 6. REVIEW & WISHLIST

### 6.1 Review — Đánh giá khóa học

```prisma
model Review {
  id       String  @id @default(cuid())
  userId   String  @map("user_id")
  courseId String  @map("course_id")
  rating   Int                     // 1-5 sao
  comment  String?                 // Nhận xét (optional)

  @@unique([userId, courseId])      // 1 user chỉ review 1 lần per course
  @@index([courseId])
}
```

**Business rules** (enforce ở service layer):

- Chỉ review khi đã enrolled
- Phải học ít nhất 30% khóa học (`review_min_progress` platform setting)
- Sau review → cập nhật `course.avgRating` và `course.reviewCount`

### 6.2 Wishlist — Yêu thích

```prisma
model Wishlist {
  id       String @id @default(cuid())
  userId   String @map("user_id")
  courseId String @map("course_id")

  @@unique([userId, courseId])
}
```

Đơn giản: bookmark course để mua sau.

---

## 7. EARNING & WITHDRAWAL — Thu nhập Instructor

### 7.1 Earning — Thu nhập từ mỗi giao dịch

```prisma
model Earning {
  id               String        @id @default(cuid())
  instructorId     String        @map("instructor_id")
  orderItemId      String        @unique @map("order_item_id")
  amount           Float                  // Giá bán
  commissionRate   Float                  // Tỷ lệ hoa hồng (0.30 = 30%)
  commissionAmount Float                  // Số tiền hoa hồng
  netAmount        Float                  // Instructor nhận thực tế
  status           EarningStatus @default(PENDING)
}
```

**Tính toán:**

```
Student mua khóa 499,000đ
├── amount = 499,000
├── commissionRate = 0.30 (30% — theo CommissionTier)
├── commissionAmount = 499,000 × 0.30 = 149,700
├── netAmount = 499,000 - 149,700 = 349,300
└── status = PENDING (chờ hết refund period)
```

**Earning lifecycle:**

```
PENDING ──(sau 7 ngày, không refund)──→ AVAILABLE ──(instructor rút)──→ WITHDRAWN
```

### 7.2 Commission Tiers — Tỷ lệ hoa hồng giảm dần

```
Doanh thu tích lũy instructor → tỷ lệ hoa hồng giảm:
├── 0 - 10 triệu: 30%
├── 10 - 50 triệu: 25%
└── > 50 triệu: 20%
```

Càng bán nhiều → platform lấy ít hơn → khuyến khích instructor.

### 7.3 Withdrawal — Rút tiền

```prisma
model Withdrawal {
  id           String           @id @default(cuid())
  instructorId String           @map("instructor_id")
  amount       Float                    // Số tiền rút
  bankInfo     Json                     // Thông tin ngân hàng
  status       WithdrawalStatus @default(PENDING)
  reviewedById String?                  // Admin xử lý
  reviewNote   String?                  // Ghi chú (nếu rejected)
  reviewedAt   DateTime?
}
```

**`bankInfo` (Json):**

```json
{
  "bankName": "Vietcombank",
  "accountNumber": "1234567890",
  "accountName": "NGUYEN VAN A",
  "branch": "Hồ Chí Minh"
}
```

**Withdrawal flow:**

```
Instructor request rút tiền (≥ 200,000đ)
├── status = PENDING
├── Admin review
│   ├── PROCESSING → chuyển khoản thủ công
│   ├── COMPLETED → đã chuyển thành công
│   └── REJECTED → ghi lý do (bankInfo sai, v.v.)
└── Earnings linked → status = WITHDRAWN
```

### 7.4 Named Relations trên Withdrawal

```prisma
// Instructor rút tiền
instructor User @relation("instructor_withdrawals", fields: [instructorId], references: [id])

// Admin review
reviewedBy User? @relation("admin_reviewed_withdrawals", fields: [reviewedById], references: [id])
```

Giống InstructorApplication — 2 foreign keys cùng trỏ về User → cần named relations.

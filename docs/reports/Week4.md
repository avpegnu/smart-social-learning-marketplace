# ĐẠI HỌC BÁCH KHOA HÀ NỘI
# TRƯỜNG CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG

**BÁO CÁO TUẦN 4: TRIỂN KHAI BACKEND CÁC MODULE CÒN LẠI**

- **Sinh viên thực hiện:** Nguyễn Việt Anh
- **MSSV:** 20225254
- **Lớp/Khóa:** IT2-02 – K67 (Kỹ thuật Máy tính)
- **Email:** Anh.NV225254@sis.hust.edu.vn
- **Số điện thoại:** 0981811366
- **Giảng viên hướng dẫn:** TS Nguyễn Thị Thanh Nga

---

## 1. TỔNG QUAN CÔNG VIỆC TUẦN 4

Tiếp nối tuần 3 đã hoàn thiện hạ tầng và các module nền tảng (Auth, Users, Courses), tuần này em triển khai toàn bộ các module nghiệp vụ cốt lõi còn lại của backend.

| Hạng mục | Nội dung | Kết quả |
|---|---|---|
| Module Ecommerce | Cart, Orders (SePay QR), Coupons, Enrollments | Hoàn thành |
| Module Learning | Course Player, Progress, Quiz, Certificates, Streaks | Hoàn thành |
| Module Social | Posts, Comments, Feed, Groups | Hoàn thành |
| Module Chat | Real-time WebSocket 1-1 (Socket.io) | Hoàn thành |
| Module QnA | Questions, Answers, Vote system | Hoàn thành |
| Module AI Tutor | RAG pipeline, SSE streaming, Groq Llama 3.3 70B | Hoàn thành |

**Tổng kết:**
- Số endpoints mới: ~73 REST endpoints + 5 WebSocket events
- Số unit tests mới: ~185 tests
- Tổng tests toàn dự án sau tuần 4: ~582 tests

---

## 2. MODULE ECOMMERCE — THANH TOÁN VÀ GHI DANH

### 2.1 Tổng quan

Module Ecommerce xử lý toàn bộ luồng doanh thu của nền tảng, từ giỏ hàng đến thanh toán và ghi danh khóa học. Module được chia thành 4 sub-module độc lập:

| Sub-module | Thư mục | Vai trò |
|---|---|---|
| Cart | `modules/cart/` | Giỏ hàng + Wishlist |
| Coupons | `modules/coupons/` | Mã giảm giá instructor |
| Orders | `modules/orders/` | Đặt hàng + Tích hợp SePay |
| Enrollments | `modules/enrollments/` | Ghi danh khóa học / chapter |

### 2.2 Module Cart — Giỏ hàng

CartService xử lý giỏ hàng với 5 validation gates khi thêm item, đảm bảo tính nhất quán dữ liệu:

**Validation gates khi `addItem()`:**

1. Khóa học tồn tại và đang PUBLISHED
2. Kiểm tra enrollment (đã mua rồi → báo lỗi)
3. Phát hiện conflict: thêm full course khi đã có chapter → auto-replace; thêm chapter khi đã có full course → reject
4. Kiểm tra item đã có trong cart chưa
5. Lấy giá từ database — **không** nhận giá từ frontend để tránh price manipulation

**Luồng mergeCart (sau đăng nhập):**

Khi user đã thêm vào cart lúc chưa đăng nhập (localStorage), hệ thống merge bằng try/catch loop — bỏ qua silently các item không còn hợp lệ thay vì fail toàn bộ.

**Endpoints Cart:**

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/cart` | Lấy giỏ hàng hiện tại |
| POST | `/api/cart/items` | Thêm item vào giỏ hàng |
| DELETE | `/api/cart/items/:id` | Xóa item khỏi giỏ hàng |
| DELETE | `/api/cart` | Xóa toàn bộ giỏ hàng |
| POST | `/api/cart/coupon` | Áp dụng mã giảm giá |
| GET | `/api/wishlists` | Danh sách yêu thích |
| POST | `/api/wishlists` | Toggle yêu thích |

### 2.3 Module Coupons — Mã giảm giá

CouponsService thực hiện validate mã giảm giá theo 6 gates tuần tự, mỗi gate trả về error code riêng biệt:

**6-gate validation `validateAndCalculateDiscount()`:**

```
Gate 1: Mã tồn tại?                    → COUPON_NOT_FOUND
Gate 2: Còn trong thời hạn?            → COUPON_EXPIRED
Gate 3: Chưa hết lượt dùng tổng?       → COUPON_MAX_USES_REACHED
Gate 4: Chưa hết lượt dùng/user?       → COUPON_MAX_USES_PER_USER_REACHED
Gate 5: Áp dụng được cho khóa trong cart? → COUPON_NOT_APPLICABLE
Gate 6: Cart đạt giá trị tối thiểu?    → COUPON_MIN_ORDER_NOT_MET
         ↓
Tính giảm giá: PERCENTAGE hoặc FIXED_AMOUNT (có cap maxDiscount)
```

*Lưu ý kỹ thuật:* Gate 4 kiểm tra per-user bằng JOIN query (`couponUsage.count WHERE couponId AND order.userId`) — không có trường `userId` trực tiếp trên CouponUsage model.

### 2.4 Module Orders — Đặt hàng và Thanh toán SePay

**Luồng đặt hàng:**

```
POST /api/orders/checkout
        ↓
Re-validate cart (giá từ DB)
Re-validate coupon (nếu có)
        ↓
Prisma Transaction:
  - Tạo Order + OrderItems
  - Ghi CouponUsage
  - Xóa Cart
        ↓
Tạo VietQR URL thanh toán
  → img.vietqr.io/image/{bankId}-{account}-compact2.png
        ↓
Trả về { order, paymentQrUrl }
```

**Định dạng orderCode:** `SSLM-{timestamp_base36}{random_4chars}` — compact, phù hợp làm nội dung chuyển khoản ngân hàng.

**Luồng xác nhận thanh toán (SePay Webhook):**

```
POST /api/webhooks/sepay (Public)
        ↓
Verify Authorization: "Apikey <secret>"
Extract orderCode bằng regex từ nội dung chuyển khoản
        ↓
Prisma Transaction (completeOrder):
  - Order.status → COMPLETED, paidAt = now()
  - Tạo Enrollment (upsert: PARTIAL → FULL nếu mua thêm)
  - Tạo ChapterPurchase (nếu mua chapter riêng)
  - Tạo Earning cho instructor:
      commission tier: 70% (< 1tr) → 60% (1-10tr) → 50% (> 10tr)
      status: PENDING, availableAt = now() + 7 ngày
```

**Endpoints Orders:**

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/orders/checkout` | Tạo đơn hàng từ cart |
| GET | `/api/orders/:id` | Chi tiết đơn hàng |
| GET | `/api/orders/:id/status` | Polling trạng thái thanh toán |
| GET | `/api/orders/history` | Lịch sử đơn hàng |
| POST | `/api/webhooks/sepay` | Webhook xác nhận thanh toán |

### 2.5 Module Enrollments — Ghi danh khóa học

EnrollmentsService phân biệt 2 loại enrollment:

| Loại | Điều kiện | Quyền truy cập |
|---|---|---|
| FULL | Mua toàn bộ khóa | Tất cả chapters + lessons |
| PARTIAL | Mua chapter riêng lẻ | Chỉ chapters đã mua |

Hàm `checkEnrollment()` trả về `{ isEnrolled, enrollmentType, purchasedChapterIds }` — frontend dùng để hiển thị đúng nút CTA (Tiếp tục học / Mua thêm / Thêm vào giỏ).

Enrollment free course (`enrollFree()`) bỏ qua toàn bộ luồng cart/order khi `course.price === 0`.

---

## 3. MODULE LEARNING — HỌC TẬP VÀ TIẾN ĐỘ

### 3.1 Tổng quan

LearningModule xử lý trải nghiệm học tập cốt lõi, chia thành 6 sub-domain:

| Sub-domain | Vai trò |
|---|---|
| Course Player | Kiểm soát quyền truy cập và trả nội dung bài học |
| Progress | Theo dõi tiến độ xem video + hoàn thành bài học |
| Quiz Attempts | Nộp bài kiểm tra + chấm điểm |
| Certificates | Cấp chứng chỉ khi hoàn thành 100% |
| Streaks | Gamification — chuỗi ngày học liên tiếp |
| Placement Tests | Bài kiểm tra xếp lớp ban đầu |

### 3.2 Course Player — Kiểm soát quyền truy cập

`GET /api/courses/:courseId/learn/:lessonId`

CoursePlayerService áp dụng **3-layer access control** theo thứ tự từ query rẻ nhất đến đắt nhất:

```
Layer 1: Lesson.isFreePreview === true?
         → Cho phép ngay (public, không cần auth)

Layer 2: Enrollment.type === FULL?
         → findUnique (chỉ 1 query)

Layer 3: ChapterPurchase tồn tại cho chapter này?
         → findUnique (chỉ khi layer 2 fail)
         
Nếu không pass layer nào → 403 LESSON_ACCESS_DENIED
```

*Lưu ý bảo mật:* Quiz questions trả về qua Prisma `select` whitelist — chỉ lấy `{ id, text, order }` của options, **không bao giờ** trả về trường `isCorrect` cho student.

### 3.3 Progress — Theo dõi tiến độ video

`PUT /api/learning/progress/:lessonId`

ProgressService xử lý video segments với thuật toán merge đoạn đã xem:

**Thuật toán mergeSegments:**

```typescript
// Input: watchedSegments hiện tại + segments mới từ frontend
// Output: danh sách segments đã merge (không overlap, sorted)
// Ví dụ: [[0,30], [20,60]] → [[0,60]]
//         [[0,30], [40,70]] → [[0,30], [40,70]]
```

**Quy tắc hoàn thành bài học:**

- `LESSON_COMPLETE_THRESHOLD = 0.8` — Xem đủ 80% video → tự động mark complete
- **"Never un-complete"**: Một bài đã complete sẽ không bao giờ bị đặt lại về chưa xong
- Khi `completionRate === 1.0` (100% khóa học) → tự động gọi `CertificatesService.generate()`

### 3.4 Quiz Attempts — Bài kiểm tra

`POST /api/learning/lessons/:lessonId/quiz/submit`

QuizAttemptsService xử lý nộp bài với các ràng buộc:

- Lookup theo `lessonId` (không theo `quizId`) để đơn giản hóa API
- Kiểm tra `maxAttempts` — giới hạn số lần làm bài
- Score lưu dạng `0.0–1.0`, trả về frontend dạng `0–100` (`Math.round(score * 100)`)
- Sau khi nộp: trả về `explanations` và `correctAnswer` cho từng câu — học viên mới biết đáp án đúng

### 3.5 Certificates — Chứng chỉ hoàn thành

CertificatesService tạo chứng chỉ **idempotent** (gọi nhiều lần chỉ tạo 1 lần):

- `verifyCode`: 8 ký tự hex ngẫu nhiên, retry tối đa 3 lần nếu collision
- `GET /api/certificates/verify/:code` là endpoint **public** — ai cũng có thể xác minh tính hợp lệ của chứng chỉ

### 3.6 Streaks — Gamification

StreaksService theo dõi chuỗi ngày học liên tiếp với xử lý edge case:

**Xử lý "today not yet active":** Nếu hôm nay chưa có hoạt động nhưng hôm qua có, streak vẫn tính từ hôm qua — tránh frustration khi user kiểm tra streak lúc nửa đêm.

**Endpoints Learning:**

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/courses/:courseId/learn/:lessonId` | Nội dung bài học |
| PUT | `/api/learning/progress/:lessonId` | Cập nhật tiến độ video |
| POST | `/api/learning/lessons/:lessonId/complete` | Đánh dấu hoàn thành |
| GET | `/api/learning/progress/:courseId` | Tiến độ toàn khóa |
| POST | `/api/learning/lessons/:lessonId/quiz/submit` | Nộp bài kiểm tra |
| GET | `/api/learning/lessons/:lessonId/quiz/attempts` | Lịch sử làm bài |
| GET | `/api/certificates/my` | Chứng chỉ của tôi |
| GET | `/api/certificates/verify/:code` | Xác minh chứng chỉ (public) |
| GET | `/api/learning/streak` | Chuỗi ngày học |
| GET | `/api/learning/dashboard` | Dashboard tổng quan học tập |

---

## 4. MODULE SOCIAL — MẠNG XÃ HỘI HỌC TẬP

### 4.1 Tổng quan

SocialModule hiện thực hóa tính năng "Social Learning" — điểm khác biệt chính của SSLM so với các platform khóa học thông thường. Gồm 4 thành phần:

| Thành phần | Số endpoints | Mô tả |
|---|---|---|
| Posts | 10 | Đăng bài, comment, share, like, bookmark |
| Feed | 2 | News feed cá nhân hóa |
| Groups | 12 | Nhóm học tập |
| Interactions | (trong Posts) | Like toggle, bookmark |

### 4.2 Posts — Bài đăng và Comments

PostsService hỗ trợ đầy đủ CRUD bài viết với soft delete, share (tăng shareCount) và nested comments 2 cấp:

**Nested Comments (2 cấp):**

```
Comment (level 1)
  └── Reply (level 2)
        └── (không hỗ trợ sâu hơn)
```

- Bình luận cấp 1: `parentId = null`
- Reply: `parentId = commentId cấp 1`
- API trả về: 3 replies đầu được inline, kèm `_count.replies` để load thêm

Counter (`commentCount`, `replyCount`) được cập nhật trong Prisma transaction để đảm bảo nhất quán.

### 4.3 Feed — News Feed cá nhân hóa

FeedService đọc từ bảng pre-computed `FeedItem` — **fanout-on-write** (ghi phân tán khi đăng bài):

**Chiến lược fanout:**

```
User đăng bài công khai:
  → Ghi FeedItem cho tất cả followers
  
User đăng bài trong Group:
  → Ghi FeedItem cho tất cả thành viên group
  
skipDuplicates: true → tránh trùng nếu user vừa follow vừa là thành viên
```

**Enrichment batch query:** Feed load xong → 2 queries song song (danh sách liked + bookmarked) → tạo `new Set()` → O(1) kiểm tra mỗi post. Tránh N+1 query.

### 4.4 Groups — Nhóm học tập

GroupsService quản lý 2 loại nhóm:

| Loại | `privacy` | Quy tắc join |
|---|---|---|
| Community Group | PUBLIC | Join tự do |
| Course Group | PRIVATE | Phải đã enrolled khóa học liên quan |

**Quy tắc đặc biệt:**
- Owner không thể rời nhóm (phải xóa nhóm hoặc chuyển ownership)
- Member management: `updateRole` (MEMBER ↔ MODERATOR), `kick`

**Endpoints Social:**

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/feed` | News feed cá nhân |
| POST | `/api/posts` | Tạo bài viết |
| PATCH | `/api/posts/:id` | Sửa bài viết |
| DELETE | `/api/posts/:id` | Xóa bài viết (soft) |
| POST | `/api/posts/:id/share` | Chia sẻ bài viết |
| POST | `/api/posts/:id/like` | Toggle like |
| POST | `/api/posts/:id/bookmark` | Toggle bookmark |
| POST | `/api/posts/:id/comments` | Thêm bình luận |
| GET | `/api/posts/:id/comments` | Danh sách bình luận |
| GET | `/api/groups` | Danh sách nhóm |
| POST | `/api/groups` | Tạo nhóm |
| POST | `/api/groups/:id/join` | Gửi yêu cầu tham gia |
| DELETE | `/api/groups/:id/leave` | Rời nhóm |
| GET | `/api/groups/:id/members` | Danh sách thành viên |
| PATCH | `/api/groups/:id/members/:userId` | Cập nhật role |
| DELETE | `/api/groups/:id/members/:userId` | Kick thành viên |

---

## 5. MODULE CHAT — NHẮN TIN THỜI GIAN THỰC

### 5.1 Kiến trúc WebSocket Chat

ChatModule kết hợp REST API (fallback) và WebSocket Gateway (Socket.io):

```
Socket.io namespace: /chat
JWT Authentication: trích xuất token từ handshake.auth.token
Rooms:
  - user_{userId}     → nhận tin nhắn mới
  - conv_{convId}     → nhận typing indicator
```

### 5.2 Luồng gửi tin nhắn

```
Client A gửi: send_message { conversationId, content }
                    ↓
ChatGateway nhận event
                    ↓
ChatService.sendMessage():
  - Kiểm tra isMember (phòng tránh BOLA)
  - Tạo Message trong DB
  - Cập nhật Conversation.lastMessageAt
                    ↓
server.to("conv_{convId}").emit("new_message", message)
  → Client A nhận (confirm)
  → Client B nhận (notification)
```

*Phân biệt `client.to()` vs `server.to()`:*
- `client.to(room)` — gửi cho tất cả **trừ** sender (dùng cho typing indicator)
- `server.to(room)` — gửi cho tất cả **kể cả** sender (dùng cho new_message)

### 5.3 Online Status

ChatService kiểm tra online status từ **Redis** (không query DB) — key `user_online:{userId}` được set khi kết nối WebSocket, xóa khi disconnect.

### 5.4 WebSocket Events

| Event | Hướng | Mô tả |
|---|---|---|
| `join_conversation` | Client → Server | Tham gia room hội thoại |
| `send_message` | Client → Server | Gửi tin nhắn |
| `new_message` | Server → Client | Nhận tin nhắn mới |
| `typing` | Client → Server | Bắt đầu gõ |
| `stop_typing` | Client → Server | Dừng gõ |
| `mark_read` | Client → Server | Đánh dấu đã đọc |

**REST Endpoints Chat:**

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/chat/conversations` | Tạo / lấy hội thoại 1-1 |
| GET | `/api/chat/conversations` | Danh sách hội thoại |
| GET | `/api/chat/conversations/:id/messages` | Lịch sử tin nhắn |
| PATCH | `/api/chat/conversations/:id/read` | Đánh dấu đã đọc |

**Dedup hội thoại:** `getOrCreateConversation(userA, userB)` đảm bảo 2 người chỉ có đúng 1 conversation — dùng `findFirst` với điều kiện cả 2 participants.

---

## 6. MODULE QNA — HỎI ĐÁP KHÓA HỌC

### 6.1 Tổng quan

QnaModule cung cấp diễn đàn hỏi đáp trong từng khóa học, với hệ thống voting để nổi bật câu trả lời tốt nhất.

### 6.2 Question System

QuestionsService xử lý CRUD câu hỏi với các tính năng:

- **findSimilar**: Tìm câu hỏi tương tự dựa trên 3 từ đầu tiên của tiêu đề — gợi ý trước khi user đăng câu hỏi trùng lặp
- **viewCount**: Tăng lượt xem theo kiểu **fire-and-forget** (`.catch(() => {})`) — metric xấp xỉ, không block response chính
- **Status filter**: Lọc `answered` (có `bestAnswerId`) / `unanswered` (chưa có)
- **markBestAnswer**: Chấp nhận từ **owner của câu hỏi** hoặc **instructor của khóa học** — mô phỏng vai trò TA (Teaching Assistant)

### 6.3 Vote System — Hệ thống bình chọn

AnswersService thực hiện vote **3-state**:

```
value = +1 (upvote):
  - Nếu đang upvote rồi → bỏ vote (toggle off)
  - Nếu đang downvote → đổi thành upvote (voteScore +2)
  - Nếu chưa vote → upvote (voteScore +1)

value = -1 (downvote):
  - Nếu đang downvote rồi → bỏ vote (toggle off)
  - Nếu đang upvote → đổi thành downvote (voteScore -2)
  - Nếu chưa vote → downvote (voteScore -1)

value = 0: Xóa vote hiện tại
```

*Ràng buộc:* User không thể vote câu trả lời của chính mình.

### 6.4 Endpoints QnA

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/courses/:courseId/questions` | Public | Danh sách câu hỏi (filter, sort) |
| POST | `/api/courses/:courseId/questions` | Bearer | Đặt câu hỏi |
| GET | `/api/questions/:id` | Public | Chi tiết câu hỏi |
| PATCH | `/api/questions/:id` | Owner | Sửa câu hỏi |
| DELETE | `/api/questions/:id` | Owner | Xóa câu hỏi |
| POST | `/api/questions/:id/best-answer/:answerId` | Owner/Instructor | Chọn câu trả lời hay nhất |
| POST | `/api/questions/:id/answers` | Bearer | Trả lời câu hỏi |
| POST | `/api/answers/:id/vote` | Bearer | Vote câu trả lời |

---

## 7. MODULE AI TUTOR — GIA SƯ AI

### 7.1 Tổng quan kiến trúc RAG

AI Tutor sử dụng kiến trúc **RAG (Retrieval-Augmented Generation)** kết hợp:

| Thành phần | Công nghệ | Mục đích |
|---|---|---|
| Embedding model | MiniLM-L6-v2 (384 dims, local) | Chuyển text → vector |
| Vector database | pgvector (PostgreSQL) | Lưu và tìm kiếm embedding |
| LLM | Groq Llama 3.3 70B (API) | Sinh câu trả lời |
| Streaming | SSE (Server-Sent Events) | Trả lời real-time từng token |
| Rate limit | Redis | 10 requests/ngày/user |

### 7.2 EmbeddingsService — Index nội dung khóa học

`onModuleInit()` tải model MiniLM-L6-v2 local (không tốn API) bằng `@huggingface/transformers`.

Hàm `indexCourseContent(courseId)` index 4 nguồn nội dung:

```
1. Course metadata (title, description, learning outcomes)
2. Sections & Chapters (title, thứ tự cấu trúc)
3. TEXT lessons (nội dung bài học đầy đủ)
4. QUIZ lessons (tiêu đề quiz + text câu hỏi)
```

Mỗi đoạn text được chunk với overlap → embed → lưu vào bảng `CourseEmbedding` dưới dạng pgvector.

*Graceful degradation:* Nếu embedding service bị lỗi, AI vẫn trả lời dựa trên kiến thức chung (không có course context).

### 7.3 AiTutorService — RAG Pipeline

**Luồng xử lý một câu hỏi:**

```
User gửi câu hỏi
        ↓
[Gate 1] Kiểm tra enrollment (có quyền học khóa không?)
        ↓
[Gate 2] Kiểm tra rate limit (còn quota trong ngày không?)
        ↓
[Retrieve] Embed câu hỏi → cosine similarity search top 5 chunks
           SELECT ... ORDER BY embedding <=> $query::vector LIMIT 5
        ↓
[Augment] Build system prompt:
          - Ngữ cảnh từ 5 chunks tìm được
          - 7 rules (chỉ trả lời về nội dung khóa học)
          - Lịch sử 10 tin nhắn gần nhất
        ↓
[Generate] Groq API (Llama 3.3 70B, temperature 0.7)
        ↓
[Stream] SSE: data: {"token": "..."} → flush từng token
         data: {"done": true, "messageId": "..."} → kết thúc
        ↓
[Save] Lưu câu trả lời hoàn chỉnh vào DB
       Auto-generate session title nếu là tin nhắn đầu tiên
```

### 7.4 SSE Streaming

**Cấu hình response header:**

```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
req.setTimeout(0); // Không timeout — streaming có thể kéo dài
```

**Format event:**

```
data: {"token": "Để"}
data: {"token": " hiểu"}
data: {"token": " về"}
...
data: {"done": true, "messageId": "clx123..."}
```

### 7.5 Session Management

- Mỗi user–course có thể có nhiều sessions (phiên hội thoại)
- Session lưu `conversationHistory` dạng JSON (last 10 messages)
- Session title tự động được generate từ câu hỏi đầu tiên

### 7.6 Endpoints AI Tutor

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/ai/tutor/ask` | Bearer (enrolled) | Đặt câu hỏi (SSE streaming) |
| GET | `/api/ai/tutor/sessions` | Bearer | Danh sách sessions |
| GET | `/api/ai/tutor/sessions/:id/messages` | Bearer | Lịch sử hội thoại |

---

## 8. KẾT QUẢ UNIT TESTS

| Module | Số tests mới | Tổng cộng |
|---|---|---|
| Ecommerce (Cart, Coupons, Orders, Enrollments) | 54 | 429 |
| Learning (Player, Progress, Quiz, Certs, Streaks) | 39 | 468 |
| Social & Chat | 45 | 513 |
| QnA | 24 | 537 |
| AI Tutor (Service + Embeddings) | 14 | 551 |
| **Tổng cộng tuần 4** | **~176** | **~582** |

Tất cả tests đều chạy với Jest + mock PrismaService (không cần database thật), đảm bảo CI/CD nhanh.

---

## 9. MỘT SỐ QUYẾT ĐỊNH KỸ THUẬT ĐÁNG CHÚ Ý

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Giá trong giỏ hàng | Lấy từ DB, không nhận từ frontend | Tránh price manipulation |
| SePay webhook auth | Parse `"Authorization: Apikey <key>"` bằng regex | SePay dùng format khác chuẩn Bearer |
| VietQR payment | Dùng URL img.vietqr.io (không cần API key) | Free tier, đủ dùng cho MVP |
| Video progress | Merge segments với thuật toán overlap | Tránh đếm trùng đoạn đã xem |
| Embedding model | MiniLM-L6-v2 chạy local | Không tốn API cost, 384 dims đủ dùng |
| AI streaming timeout | `req.setTimeout(0)` | SSE có thể kéo dài > 30s mặc định |
| pgvector query | `embedding <=> $query::vector` (cosine) | Tìm ngữ nghĩa, không chỉ keyword |
| Fanout-on-write | Ghi FeedItem khi đăng bài | Đọc feed O(1), không join phức tạp |
| Vote 3-state | Cùng giá trị toggle off, khác giá trị swing 2x | UX tự nhiên, tránh double-vote |
| ESM compatibility | `await import('@huggingface/transformers')` | CJS project không import ESM module trực tiếp |

---

## 10. KẾ HOẠCH TUẦN TIẾP THEO

Triển khai **Frontend** cho cả hai portal:

- **Student Portal** (Next.js 16): Trang chủ, duyệt khóa học, chi tiết khóa học, thanh toán, trình xem bài học (video player), bài kiểm tra, AI Tutor, diễn đàn Q&A, mạng xã hội, chat
- **Management Portal** (Next.js 16): Dashboard instructor, quản lý khóa học (course wizard, curriculum editor), dashboard admin, duyệt khóa học/instructor
- **Shared packages**: TanStack Query hooks, API client, shared UI components, i18n (vi + en), dark mode

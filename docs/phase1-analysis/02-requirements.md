# 2. REQUIREMENTS (Yêu cầu hệ thống)

## Kiến trúc: 2 Web App

- **Student Portal** (app.com) — FR-1 → FR-7
- **Management Portal** (manage.app.com) — FR-4, FR-8
- **Shared Backend API** — Cả 2 portal gọi chung 1 backend

---

# A. FUNCTIONAL REQUIREMENTS (Yêu cầu chức năng)

## FR-1: Authentication & Authorization

| ID     | Requirement                                         | Priority | Portal     |
| ------ | --------------------------------------------------- | -------- | ---------- |
| FR-1.1 | Đăng ký bằng email + mật khẩu + xác nhận email      | Must     | Student    |
| FR-1.2 | Đăng ký/Đăng nhập bằng Google OAuth                 | Should   | Student    |
| FR-1.3 | Đăng nhập → JWT (access 15m + refresh 7d, rotation) | Must     | Cả hai     |
| FR-1.4 | Quên mật khẩu → Reset qua email                     | Must     | Cả hai     |
| FR-1.5 | Phân quyền role: Student, Instructor, Admin         | Must     | Cả hai     |
| FR-1.6 | Rate limiting login (5 lần/15 phút per IP)          | Should   | Cả hai     |
| FR-1.7 | Đăng ký làm Instructor (submit application form)    | Must     | Student    |
| FR-1.8 | Cross-portal auth (One-Time Token redirect)         | Must     | Cả hai     |
| FR-1.9 | Management Portal guard (chặn Student chưa duyệt)   | Must     | Management |

## FR-2: User Profile

| ID     | Requirement                                                  | Priority | Portal     |
| ------ | ------------------------------------------------------------ | -------- | ---------- |
| FR-2.1 | CRUD profile: avatar (Cloudinary), bio, skills, social links | Must     | Student    |
| FR-2.2 | Instructor profile: bằng cấp, kinh nghiệm, chuyên môn        | Must     | Management |
| FR-2.3 | Public profile page (viewable by others)                     | Must     | Student    |
| FR-2.4 | Learning profile: skills map, certificates, streak           | Should   | Student    |

## FR-3: Course Marketplace (Ecommerce)

| ID      | Requirement                                             | Priority | Portal  |
| ------- | ------------------------------------------------------- | -------- | ------- |
| FR-3.1  | Danh sách khóa học + pagination + caching               | Must     | Student |
| FR-3.2  | Filter: category, price range, rating, level, language  | Must     | Student |
| FR-3.3  | Sort: popular, newest, highest rated, price             | Must     | Student |
| FR-3.4  | Full-text search (PostgreSQL tsvector + GIN index)      | Must     | Student |
| FR-3.5  | Chi tiết khóa: mô tả, curriculum, preview, instructor   | Must     | Student |
| FR-3.6  | Hiển thị giá cả khóa + giá từng chapter                 | Must     | Student |
| FR-3.7  | Shopping Cart (DB + localStorage merge khi login)       | Must     | Student |
| FR-3.8  | Checkout + SePay QR bank transfer + webhook             | Must     | Student |
| FR-3.9  | Mua từng chapter riêng lẻ + upgrade to full course      | Must     | Student |
| FR-3.10 | Coupon áp dụng khi checkout (validate + race condition) | Should   | Student |
| FR-3.11 | Order history + Invoice                                 | Should   | Student |
| FR-3.12 | Wishlist + thông báo giảm giá                           | Could    | Student |
| FR-3.13 | Rating & Review (≥30% progress, incremental avg)        | Must     | Student |
| FR-3.14 | Gợi ý upgrade full course khi mua lẻ chapters           | Should   | Student |
| FR-3.15 | Refund trong 7 ngày nếu học < 10%                       | Should   | Student |

## FR-4: Course Management (Instructor)

| ID      | Requirement                                                   | Priority | Portal     |
| ------- | ------------------------------------------------------------- | -------- | ---------- |
| FR-4.1  | Tạo khóa học wizard (multi-step: info → curriculum → pricing) | Must     | Management |
| FR-4.2  | Tạo curriculum: Section → Chapter → Lesson                    | Must     | Management |
| FR-4.3  | Upload video (Cloudinary signed upload, direct từ client)     | Must     | Management |
| FR-4.4  | Video auto-transcode (Cloudinary eager transforms 480/720p)   | Must     | Management |
| FR-4.5  | Video status tracking (UPLOADING → READY)                     | Must     | Management |
| FR-4.6  | Tạo text content (rich text editor)                           | Must     | Management |
| FR-4.7  | Upload tài liệu đính kèm (PDF, slides)                        | Should   | Management |
| FR-4.8  | Tạo quiz: multiple choice, true/false + giải thích            | Must     | Management |
| FR-4.9  | Drag & drop sắp xếp lessons/chapters                          | Should   | Management |
| FR-4.10 | Thiết lập giá: cả khóa + từng chapter (validate sum)          | Must     | Management |
| FR-4.11 | Quản lý coupon (CRUD, usage tracking, race condition)         | Should   | Management |
| FR-4.12 | Dashboard doanh thu + biểu đồ                                 | Must     | Management |
| FR-4.13 | Yêu cầu rút tiền (min threshold, admin approval)              | Must     | Management |
| FR-4.14 | Submit khóa học để review                                     | Must     | Management |

## FR-5: Learning Experience

| ID      | Requirement                                                      | Priority | Portal  |
| ------- | ---------------------------------------------------------------- | -------- | ------- |
| FR-5.1  | Course Player: video (Cloudinary streaming) + sidebar curriculum | Must     | Student |
| FR-5.2  | Video player: tốc độ, subtitle, resume position                  | Should   | Student |
| FR-5.3  | Video progress: watched segments tracking (% thực xem)           | Must     | Student |
| FR-5.4  | Lesson completion logic (80% video/scroll text/quiz pass)        | Must     | Student |
| FR-5.5  | Course progress = completed / accessible lessons                 | Must     | Student |
| FR-5.6  | Partial enrollment progress (chỉ tính chapters đã mua)           | Must     | Student |
| FR-5.7  | Làm quiz + chấm điểm tự động + giải thích                        | Must     | Student |
| FR-5.8  | Dashboard tiến trình: courses, streak, time, skills map          | Must     | Student |
| FR-5.9  | Generate certificate PDF (Puppeteer) khi 100% complete           | Should   | Student |
| FR-5.10 | Verify certificate bằng unique ID (public API)                   | Could    | Student |
| FR-5.11 | Placement test (đánh giá trình độ → gợi ý khóa)                  | Should   | Student |

## FR-6: Social Learning Network

| ID      | Requirement                                                 | Priority | Portal  |
| ------- | ----------------------------------------------------------- | -------- | ------- |
| FR-6.1  | News Feed (fanout-on-write, pre-computed)                   | Must     | Student |
| FR-6.2  | Tạo post: text, image, code snippet                         | Must     | Student |
| FR-6.3  | Tương tác: Like, Comment, Share, Bookmark                   | Must     | Student |
| FR-6.4  | Follow/Unfollow + follower count                            | Must     | Student |
| FR-6.5  | Real-time Chat (Socket.io, in-memory adapter)               | Must     | Student |
| FR-6.6  | Chat: text, image, code snippet, file sharing               | Should   | Student |
| FR-6.7  | Typing indicator + read receipts                            | Could    | Student |
| FR-6.8  | Groups: CRUD, join, post, manage members                    | Must     | Student |
| FR-6.9  | Auto-create group cho mỗi khóa học approved                 | Should   | Student |
| FR-6.10 | Q&A Forum: hỏi, trả lời, vote, best answer                  | Must     | Student |
| FR-6.11 | Gợi ý câu hỏi tương tự (full-text search existing Q&A)      | Could    | Student |
| FR-6.12 | Multi-channel notifications (in-app + email via Gmail SMTP) | Must     | Cả hai  |
| FR-6.13 | Notification preferences (user configurable)                | Should   | Student |
| FR-6.14 | Notification aggregation (group similar notifications)      | Should   | Student |

## FR-7: Recommendation System (Algorithm-based, không AI)

| ID     | Requirement                                              | Priority | Portal  |
| ------ | -------------------------------------------------------- | -------- | ------- |
| FR-7.1 | Content-Based Filtering (Cosine Similarity on tags)      | Must     | Student |
| FR-7.2 | Collaborative Filtering (Jaccard Similarity, item-based) | Must     | Student |
| FR-7.3 | Popularity ranking (Wilson Score + Time Decay trending)  | Must     | Student |
| FR-7.4 | Hybrid weighted scoring (adaptive weights by user data)  | Must     | Student |
| FR-7.5 | Smart Chapter Suggestion (tag overlap analysis)          | Must     | Student |
| FR-7.6 | Context-aware display (homepage vs detail vs post-buy)   | Should   | Student |
| FR-7.7 | Pre-compute similarity matrices (nightly cron)           | Should   | Backend |
| FR-7.8 | Cache recommendations per user (Redis, 1h TTL)           | Should   | Backend |

## FR-8: AI Features

| ID     | Requirement                                                       | Priority | Portal  |
| ------ | ----------------------------------------------------------------- | -------- | ------- |
| FR-8.1 | AI Tutor: RAG chat (Groq Llama 3.3 + local embeddings + pgvector) | Must     | Student |
| FR-8.2 | AI Tutor: lưu lịch sử chat theo khóa                              | Should   | Student |
| FR-8.3 | Rate limiting AI queries (10/ngày, Groq 30 req/min)               | Should   | Student |

## FR-9: Admin Management

| ID     | Requirement                                        | Priority | Portal     |
| ------ | -------------------------------------------------- | -------- | ---------- |
| FR-9.1 | Phê duyệt/Từ chối Instructor applications          | Must     | Management |
| FR-9.2 | Phê duyệt/Từ chối khóa học (checklist review)      | Must     | Management |
| FR-9.3 | Quản lý users (view, search, suspend, change role) | Must     | Management |
| FR-9.4 | Xử lý reports (dismiss, warning, remove, suspend)  | Must     | Management |
| FR-9.5 | Dashboard thống kê nền tảng (pre-computed daily)   | Must     | Management |
| FR-9.6 | Quản lý categories (CRUD)                          | Must     | Management |
| FR-9.7 | Cấu hình hoa hồng (tier-based commission)          | Should   | Management |
| FR-9.8 | Review & approve withdrawal requests               | Must     | Management |

---

## Tổng kết MoSCoW

| Priority   | Count | Mô tả                                 |
| ---------- | ----- | ------------------------------------- |
| **Must**   | 46    | Core — hệ thống không hoạt động thiếu |
| **Should** | 18    | Important — bổ sung sau MVP           |
| **Could**  | 5     | Nice-to-have                          |
| **Total**  | 69    |                                       |

## Tính năng Won't Have (v1)

- Livestream
- Subscription plan (monthly payment)
- Mobile app (native)
- Multi-language content (i18n cho nội dung khóa)
- Affiliate program

---

# B. NON-FUNCTIONAL REQUIREMENTS (Yêu cầu phi chức năng)

## NFR-1: Performance (Hiệu năng)

| ID      | Requirement                                 | Metric        |
| ------- | ------------------------------------------- | ------------- |
| NFR-1.1 | Thời gian load trang trung bình             | < 2 giây      |
| NFR-1.2 | API response time (CRUD operations)         | < 500ms (P95) |
| NFR-1.3 | Search response time (full-text search)     | < 1 giây      |
| NFR-1.4 | AI Tutor response time (Groq RAG query)     | < 5 giây      |
| NFR-1.5 | Video streaming start time (Cloudinary CDN) | < 3 giây      |
| NFR-1.6 | Real-time chat message delivery             | < 200ms       |
| NFR-1.7 | Notification delivery (realtime)            | < 1 giây      |
| NFR-1.8 | Recommendation generation                   | < 2 giây      |

## NFR-2: Scalability (Khả năng mở rộng)

| ID      | Requirement                                | Target                  |
| ------- | ------------------------------------------ | ----------------------- |
| NFR-2.1 | Hỗ trợ số người dùng đồng thời (free tier) | 50-100 concurrent users |
| NFR-2.2 | Hỗ trợ tổng số khóa học                    | 1,000+ courses          |
| NFR-2.3 | Video storage (Cloudinary free)            | 25GB (~50 videos)       |
| NFR-2.4 | Database (Neon free)                       | 0.5GB, auto-suspend     |

## NFR-3: Security (Bảo mật)

| ID       | Requirement              | Detail                        |
| -------- | ------------------------ | ----------------------------- |
| NFR-3.1  | Mã hóa mật khẩu          | bcrypt (salt rounds: 12)      |
| NFR-3.2  | Authentication           | JWT (access + refresh token)  |
| NFR-3.3  | HTTPS/TLS                | Bắt buộc cho mọi connection   |
| NFR-3.4  | SQL injection protection | Prisma ORM (parameterized)    |
| NFR-3.5  | XSS protection           | Input sanitization + CSP      |
| NFR-3.6  | CSRF protection          | CSRF tokens cho form          |
| NFR-3.7  | Rate limiting            | API rate limiting per user    |
| NFR-3.8  | File upload validation   | Type, size check (Cloudinary) |
| NFR-3.9  | Video content protection | Cloudinary signed URLs        |
| NFR-3.10 | Payment data security    | SePay webhook verification    |
| NFR-3.11 | CORS configuration       | Whitelist allowed origins     |

## NFR-4: Reliability & Availability (Tin cậy & Khả dụng)

| ID      | Requirement                              | Target              |
| ------- | ---------------------------------------- | ------------------- |
| NFR-4.1 | Uptime (Render free + cron keep-alive)   | ~99% (excl. deploy) |
| NFR-4.2 | Database backup (Neon built-in)          | Point-in-time       |
| NFR-4.3 | Error handling & logging                 | Sentry.io free tier |
| NFR-4.4 | Graceful degradation khi AI service down | Fallback message    |

## NFR-5: Usability (Khả năng sử dụng)

| ID      | Requirement                  | Detail                       |
| ------- | ---------------------------- | ---------------------------- |
| NFR-5.1 | Responsive design            | Mobile, Tablet, Desktop      |
| NFR-5.2 | Hỗ trợ ngôn ngữ              | Tiếng Việt (chính) + English |
| NFR-5.3 | Accessibility                | WCAG 2.1 Level A cơ bản      |
| NFR-5.4 | Loading states & Skeleton UI | Mọi async operation          |
| NFR-5.5 | Error messages thân thiện    | User-friendly, không lộ tech |
| NFR-5.6 | Consistent UI/UX             | Shadcn/ui design system      |

## NFR-6: Maintainability (Khả năng bảo trì)

| ID      | Requirement               | Detail                        |
| ------- | ------------------------- | ----------------------------- |
| NFR-6.1 | Code convention & linting | ESLint + Prettier             |
| NFR-6.2 | API documentation         | Swagger/OpenAPI (NestJS auto) |
| NFR-6.3 | Unit test coverage        | > 60% cho business logic      |
| NFR-6.4 | Version control           | Git + branching strategy      |
| NFR-6.5 | CI/CD pipeline            | GitHub Actions (free)         |
| NFR-6.6 | Environment configuration | .env per environment          |
| NFR-6.7 | Code structure            | NestJS modular architecture   |

## NFR-7: Compatibility (Tương thích)

| ID      | Requirement               | Detail                        |
| ------- | ------------------------- | ----------------------------- |
| NFR-7.1 | Browser support           | Chrome, Firefox, Safari, Edge |
| NFR-7.2 | Minimum screen resolution | 320px (mobile)                |
| NFR-7.3 | Video format support      | MP4 (H.264), WebM             |

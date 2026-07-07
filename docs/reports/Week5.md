# ĐẠI HỌC BÁCH KHOA HÀ NỘI

# TRƯỜNG CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG

**BÁO CÁO TUẦN 5: HOÀN THIỆN QUESTION BANK, TÍCH HỢP RECOMMENDATIONS VÀ NÂNG CẤP UI**

- **Sinh viên thực hiện:** Nguyễn Việt Anh
- **MSSV:** 20225254
- **Lớp/Khóa:** IT2-02 – K67 (Kỹ thuật Máy tính)
- **Email:** Anh.NV225254@sis.hust.edu.vn
- **Số điện thoại:** 0981811366
- **Giảng viên hướng dẫn:** TS Nguyễn Thị Thanh Nga

---

## 1. TỔNG QUAN CÔNG VIỆC TUẦN 5

Tuần này em tập trung vào ba nhóm cải tiến chính: hoàn thiện tính năng Question Bank với hệ thống tag và độ khó theo từng bank, tích hợp Recommendation System vào giao diện học viên, và nâng cấp tổng thể UI/UX theo hướng hiện đại với hệ màu OKLCH.

| Hạng mục                         | Nội dung                                                | Kết quả    |
| -------------------------------- | ------------------------------------------------------- | ---------- |
| Question Bank — Per-bank Tags    | Tags scoped riêng từng bank, CRUD inline                | Hoàn thành |
| Question Bank — Difficulty       | Field difficulty cho mỗi câu hỏi (5 cấp)                | Hoàn thành |
| Question Bank — Filter import    | Lọc theo difficulty + tags khi import vào quiz          | Hoàn thành |
| Recommendation System — Backend  | Cron tính similarity, popularity với full course fields | Hoàn thành |
| Recommendation System — Frontend | Tích hợp 4 contexts ở 4 trang student                   | Hoàn thành |
| UI Refresh — Color System v2     | Migrate hex → OKLCH, multi-accent palette               | Hoàn thành |
| UI Refresh — Component Polish    | Button, Card, Input, Skeleton hover/focus states        | Hoàn thành |
| Course Detail UX                 | Share + Wishlist với toast feedback                     | Hoàn thành |
| Auth Layout                      | Logo có thể click về trang chủ                          | Hoàn thành |
| Admin Analytics — 3 bug fixes    | Data envelope, cron shape, range aggregation            | Hoàn thành |
| Bug fixes nhỏ                    | QnA list spacing                                        | Hoàn thành |

---

## 2. HOÀN THIỆN MODULE QUESTION BANK

### 2.1 Bối cảnh

Tuần trước em đã triển khai Question Bank — công cụ giúp instructor tái sử dụng câu hỏi qua nhiều khóa học. Tuy nhiên trong quá trình sử dụng thực tế phát sinh hai vấn đề cần giải quyết:

1. **Tag chung toàn hệ thống không phù hợp**: Instructor muốn tự quản lý tags riêng cho từng bank (ví dụ: bank "JavaScript" có tags `closure`, `async`, `prototype`; bank "Python" có tags `decorator`, `generator`). Tags global khiến namespace bị rối.
2. **Thiếu phân loại độ khó**: Khi import câu hỏi từ bank vào quiz, instructor không có cách lọc câu hỏi theo độ khó (dễ / trung bình / khó) để tạo đề thi cân bằng.

### 2.2 Thiết kế giải pháp

**Schema changes (Prisma):**

```prisma
model QuestionBankTag {
  id     String @id @default(cuid())
  bankId String @map("bank_id")
  name   String
  bank   QuestionBank @relation(fields: [bankId], references: [id], onDelete: Cascade)

  @@unique([bankId, name])  // Tag không trùng trong cùng bank
  @@map("question_bank_tags")
}

model QuestionBankItem {
  // ... existing fields
  difficulty CourseLevel?  // BEGINNER | INTERMEDIATE | ADVANCED | EXPERT | ALL_LEVELS
  tagIds     String[]      @map("tag_ids")  // Array reference đến QuestionBankTag.id
}
```

**Thiết kế quan trọng:**

- Tags scoped theo `bankId` (không global) — instructor chỉ thấy tags của bank họ đang quản lý
- `@@unique([bankId, name])` đảm bảo trong cùng 1 bank không có 2 tag trùng tên, nhưng tag cùng tên có thể tồn tại ở nhiều bank khác nhau
- `tagIds` lưu dạng String[] (PostgreSQL array) thay vì bảng join — đơn giản hóa query và phù hợp với use case "1 câu hỏi gắn nhiều tag"
- `difficulty` reuse enum `CourseLevel` đã có sẵn — không cần tạo enum mới

### 2.3 Backend — Tag CRUD endpoints

4 endpoints mới được thêm vào module question-banks:

| Method | Endpoint                                         | Mô tả                   |
| ------ | ------------------------------------------------ | ----------------------- |
| GET    | `/api/instructor/question-banks/:id/tags`        | Danh sách tags của bank |
| POST   | `/api/instructor/question-banks/:id/tags`        | Tạo tag mới             |
| PATCH  | `/api/instructor/question-banks/:id/tags/:tagId` | Đổi tên tag             |
| DELETE | `/api/instructor/question-banks/:id/tags/:tagId` | Xóa tag                 |

**Xử lý xóa tag — orphaned tagIds:**

Khi xóa một tag, hệ thống phải dọn dẹp tagId đó khỏi tất cả `QuestionBankItem.tagIds` đang tham chiếu. Em sử dụng hàm `array_remove` của PostgreSQL trong raw query:

```sql
UPDATE question_bank_items
SET tag_ids = array_remove(tag_ids, $1)
WHERE bank_id = $2 AND $1 = ANY(tag_ids);
```

Đây là cách hiệu quả hơn so với load tất cả items, filter trong JavaScript, rồi update từng item.

### 2.4 Frontend — Bank Detail Page

**Inline Tag Chip CRUD:**

Trang chi tiết bank hiển thị danh sách tags dưới dạng các chip có thể chỉnh sửa trực tiếp:

- Click vào nút `+` để thêm tag mới (hiện input inline)
- Click vào icon `pencil` trên chip để đổi tên
- Click vào icon `x` để xóa (có confirm dialog)

**Question Form mở rộng:**

Form tạo/sửa câu hỏi được bổ sung:

- Dropdown chọn `difficulty` (5 options theo CourseLevel enum)
- Multi-select tags từ danh sách tags của bank hiện tại

### 2.5 Frontend — Import Dialog cải tiến

**ImportFromBankDialog** (sử dụng trong Quiz Builder) được nâng cấp:

```
┌─────────────────────────────────────────────┐
│ Chọn câu hỏi từ Bank                        │
├─────────────────────────────────────────────┤
│ Bank: [JavaScript Fundamentals    ▼]        │
│                                             │
│ Difficulty: [Tất cả ▼]  Tags: [closure ×]   │
│                          [async ×] [+]      │
│                                             │
│ ☐ Question 1 — easy — [closure]            │
│ ☑ Question 2 — medium — [async, promise]   │
│ ☑ Question 3 — hard — [closure, scope]     │
│ ☐ Question 4 — easy — [arrow-fn]           │
│                                             │
│           [Cancel]  [Import 2 questions]    │
└─────────────────────────────────────────────┘
```

Filter logic chạy ở client-side sau khi load toàn bộ items của bank — phù hợp vì 1 bank thường có < 200 câu hỏi.

**ImportBankTextDialog (mới)** — dùng trên trang Bank Detail để import hàng loạt câu hỏi từ text:

- **Bước 1:** Paste danh sách câu hỏi (mỗi câu trên 1 dòng, đáp án đánh dấu `*`)
- **Bước 2:** Gán difficulty và tags chung cho toàn bộ batch

### 2.6 Bug fix trong quá trình hoàn thiện

**Bug `questionCount` hiển thị 0:**

Trang danh sách bank hiển thị `questionCount` luôn bằng 0 dù bank có nhiều câu hỏi. Nguyên nhân: counter denormalized trên `QuestionBank` không được cập nhật khi tạo/xóa item. Sửa bằng cách wrap thao tác CRUD trong Prisma transaction kèm `update questionCount`.

**Fix `tsconfig.json` types cho IDE:**

Jest types không được nhận diện trong VS Code → tự động complete không hoạt động khi viết test. Bổ sung `"types": ["jest", "node"]` vào `compilerOptions`.

### 2.7 Tests

Tổng cộng **25 tests** mới cho phase này (service, controller, tag CRUD, orphan cleanup).

---

## 3. MODULE RECOMMENDATION SYSTEM

### 3.1 Tổng quan và mục tiêu

Recommendation System (hệ thống gợi ý) là một trong những tính năng "smart" cốt lõi của SSLM, giúp học viên khám phá khóa học phù hợp dựa trên sở thích, hành vi, và xu hướng cộng đồng. Module này được thiết kế để giải quyết bài toán **"Cold start" + "Long tail"** trong marketplace giáo dục:

- **Cold start**: User mới chưa có lịch sử → cần gợi ý dựa trên độ phổ biến
- **Long tail**: Khóa học chất lượng cao nhưng ít người biết → cần thuật toán nội dung để khám phá

**Yêu cầu kỹ thuật:**

1. Hỗ trợ nhiều ngữ cảnh khác nhau (homepage, course detail, sau khi mua, sau khi hoàn thành)
2. Phản hồi nhanh O(1) khi serve — không tính toán real-time
3. Không phụ thuộc vào dịch vụ ML bên ngoài (free tier project)
4. Có khả năng fallback khi dữ liệu chưa đủ

### 3.2 Kiến trúc — Compute/Serve Separation

Module sử dụng kiến trúc **tách biệt giữa tính toán (compute) và phục vụ (serve)**:

```
┌──────────────────────────────────────────┐
│  COMPUTE LAYER (Cron — 2AM hàng ngày)    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ computeAllSimilarities()         │    │
│  │  ├── Content-Based  → Cosine     │    │
│  │  ├── Collaborative  → Jaccard    │    │
│  │  └── Popularity     → Wilson     │    │
│  └──────────────────────────────────┘    │
│             │ O(N²) computation          │
│             ↓                            │
│  ┌──────────────────────────────────┐    │
│  │ Bảng CourseSimilarity            │    │
│  │  (sourceId, targetId, score,     │    │
│  │   algorithm)                     │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
                    │
                    │ DB read
                    ↓
┌──────────────────────────────────────────┐
│  SERVE LAYER (HTTP request)              │
│                                          │
│  GET /api/recommendations?context=...    │
│        ↓                                 │
│  RecommendationsService                  │
│  - Đọc top K từ CourseSimilarity         │
│  - JOIN với Course → trả về full data    │
│  - O(1) per request                      │
└──────────────────────────────────────────┘
```

**Lợi ích:**

- Compute O(N²) chỉ chạy 1 lần/ngày thay vì mỗi request
- Serve O(1) — đủ nhanh để hiển thị inline trong page load
- Có thể swap thuật toán mà không thay đổi serving layer

### 3.3 Thuật toán 1 — Content-Based Filtering

**Ý tưởng:** Hai khóa học có nhiều tags chung → tương tự nhau về nội dung.

**Biểu diễn dữ liệu:** Mỗi khóa học được biểu diễn bằng một **tag vector nhị phân**. Giả sử hệ thống có 5 tags `[js, react, nodejs, python, ml]`:

```
Course A (JavaScript Basics):    [1, 0, 0, 0, 0]
Course B (React Mastery):        [1, 1, 0, 0, 0]
Course C (Full Stack JS):        [1, 1, 1, 0, 0]
Course D (Python ML):            [0, 0, 0, 1, 1]
```

**Công thức Cosine Similarity:**

```
              A · B            Σ (Aᵢ × Bᵢ)
sim(A, B) = ─────────  =  ──────────────────────
            ‖A‖ × ‖B‖     √(Σ Aᵢ²) × √(Σ Bᵢ²)
```

**Ví dụ tính:**

- `sim(A, B) = (1·1 + 0·1 + 0 + 0 + 0) / (√1 × √2) = 1 / √2 ≈ 0.707`
- `sim(A, D) = 0 / (√1 × √2) = 0`
- `sim(B, C) = (1 + 1 + 0 + 0 + 0) / (√2 × √3) ≈ 0.816`

**Tối ưu — Pairwise Triangle:**

Vì cosine đối xứng (`sim(A,B) = sim(B,A)`), chỉ cần tính nửa tam giác trên của ma trận:

```typescript
for (let i = 0; i < courses.length; i++) {
  for (let j = i + 1; j < courses.length; j++) {
    // bắt đầu từ i+1
    const score = cosineSimilarity(vectors[i], vectors[j]);
    if (score >= 0.1) {
      // threshold
      // Lưu cả 2 chiều để query nhanh
      results.push({ sourceId: i, targetId: j, score, algorithm: 'CONTENT' });
      results.push({ sourceId: j, targetId: i, score, algorithm: 'CONTENT' });
    }
  }
}
```

**Threshold 0.1**: Cặp khóa có similarity < 0.1 không được lưu — tránh nhiễu (noise) trong gợi ý.

### 3.4 Thuật toán 2 — Collaborative Filtering

**Ý tưởng:** "Học viên cũng đã mua" — Hai khóa học được mua bởi nhiều user chung → nên được gợi ý cùng nhau.

**Công thức Jaccard Similarity:**

```
           |Uₐ ∩ Uᵦ|       (số user chung)
J(A, B) = ───────────  =  ─────────────────
           |Uₐ ∪ Uᵦ|      (tổng số user)
```

Trong đó `Uₐ` là tập user đã enroll khóa A, `Uᵦ` là tập user đã enroll khóa B.

**Ví dụ:**

- Khóa A có users: `{u1, u2, u3, u4}`
- Khóa B có users: `{u2, u3, u5}`
- Intersection: `{u2, u3}` → 2 phần tử
- Union: `{u1, u2, u3, u4, u5}` → 5 phần tử
- `J(A, B) = 2/5 = 0.4`

**Tối ưu — Map<courseId, Set<userId>>:**

Thay vì query DB cho mỗi cặp (O(N² × DB queries)), em load 1 lần toàn bộ enrollments vào memory:

```typescript
// 1 query duy nhất
const enrollments = await prisma.enrollment.findMany({
  select: { courseId: true, userId: true },
  where: { status: 'ACTIVE' },
});

// Build Map<courseId, Set<userId>>
const courseUsers = new Map<string, Set<string>>();
for (const e of enrollments) {
  if (!courseUsers.has(e.courseId)) courseUsers.set(e.courseId, new Set());
  courseUsers.get(e.courseId)!.add(e.userId);
}

// Pairwise compute với Set operations (O(min(|A|, |B|)) cho intersection)
for (const [a, usersA] of courseUsers) {
  for (const [b, usersB] of courseUsers) {
    if (a >= b) continue; // triangle
    const intersection = [...usersA].filter((u) => usersB.has(u)).length;
    const union = usersA.size + usersB.size - intersection;
    const score = union === 0 ? 0 : intersection / union;
    // ...
  }
}
```

### 3.5 Thuật toán 3 — Popularity với Wilson Score

**Vấn đề với rating trung bình thông thường:**

```
Khóa A: rating 5.0 ★ (1 review)
Khóa B: rating 4.5 ★ (100 reviews)
```

Sắp xếp theo rating trung bình → A hơn B. Nhưng thực tế B đáng tin cậy hơn nhiều.

**Giải pháp — Wilson Score Lower Bound** (giới hạn dưới của khoảng tin cậy):

```
                p̂ + z²/(2n) − z × √( p̂(1−p̂)/n + z²/(4n²) )
Wilson(p̂, n) = ────────────────────────────────────────────
                              1 + z²/n
```

Trong đó:

- `p̂` = tỉ lệ rating tích cực (rating ≥ 4 sao)
- `n` = tổng số reviews
- `z` = 1.96 (95% confidence)

**Trực quan:** Wilson Score "phạt" các khóa có ít reviews — chỉ khi có đủ dữ liệu thì điểm số mới gần với rating thực tế. Reddit, Yelp đều dùng công thức này.

**Time Decay (logarithmic):**

Khóa học mới ra cũng cần được "nâng đỡ" so với khóa cũ:

```typescript
const ageInDays = (Date.now() - course.createdAt.getTime()) / (1000 * 60 * 60 * 24);
const timeDecay = 1 / Math.log2(ageInDays + 2);
// Course mới (1 ngày): timeDecay ≈ 0.63
// Course 30 ngày: timeDecay ≈ 0.20
// Course 365 ngày: timeDecay ≈ 0.12
```

**Combined score:**

```typescript
const popularityScore = 0.7 * wilsonScore + 0.3 * timeDecay;
```

Tỉ lệ 70/30 ưu tiên chất lượng (Wilson) hơn độ mới (time decay).

### 3.6 Context-Aware Serving

Module hỗ trợ 4 ngữ cảnh, mỗi ngữ cảnh sử dụng thuật toán phù hợp nhất:

| Context         | Thuật toán                   | Lý do                                                                      |
| --------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `homepage`      | **Hybrid** (CB 50% + CF 50%) | User vào trang chủ — cần đa dạng cả nội dung lẫn hành vi cộng đồng         |
| `course_detail` | **Content-Based**            | "Khóa học tương tự" — tập trung vào sự tương đồng nội dung                 |
| `post_purchase` | **Collaborative**            | "Học viên cũng mua" — gợi ý dựa trên nhóm user có cùng hành vi mua         |
| `post_complete` | **Content-Based**            | "Tiếp tục với" — sau khi hoàn thành, gợi ý khóa cùng chủ đề để học sâu hơn |

**Hybrid combination:**

```typescript
async computeHybrid(courseId: string, limit: number) {
  const [contentBased, collaborative] = await Promise.all([
    this.getContentBased(courseId, limit * 2),
    this.getCollaborative(courseId, limit * 2),
  ]);

  const merged = new Map<string, number>();
  for (const item of contentBased) {
    merged.set(item.targetId, (merged.get(item.targetId) ?? 0) + item.score * 0.5);
  }
  for (const item of collaborative) {
    merged.set(item.targetId, (merged.get(item.targetId) ?? 0) + item.score * 0.5);
  }

  return Array.from(merged.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}
```

**Fallback mechanism:**

Nếu không có dữ liệu trong `CourseSimilarity` (cold start hoặc khóa quá mới):

```typescript
async getRecommendations(context, courseId, limit) {
  let results = await this.queryByContext(context, courseId, limit);
  if (results.length === 0) {
    // Fallback về popularity
    results = await this.popularityService.getTop(limit);
  }
  return results;
}
```

### 3.7 Database Schema

```prisma
model CourseSimilarity {
  id             String              @id @default(cuid())
  sourceCourseId String              @map("source_course_id")
  targetCourseId String              @map("target_course_id")
  score          Float
  algorithm      RecommendationAlgo  // CONTENT | COLLABORATIVE
  computedAt     DateTime            @default(now()) @map("computed_at")

  sourceCourse Course @relation("SimilaritySource", fields: [sourceCourseId], references: [id], onDelete: Cascade)
  targetCourse Course @relation("SimilarityTarget", fields: [targetCourseId], references: [id], onDelete: Cascade)

  @@unique([sourceCourseId, targetCourseId, algorithm])
  @@index([sourceCourseId, algorithm, score(sort: Desc)])
  @@map("course_similarities")
}

enum RecommendationAlgo {
  CONTENT
  COLLABORATIVE
}
```

**Index quan trọng:** `[sourceCourseId, algorithm, score(sort: Desc)]` — Postgres dùng index này để serve query "top K similarities cho course X" trong O(log N + K).

### 3.8 Cron Job

Cron job daily được schedule lúc 2AM (lúc traffic thấp nhất):

```typescript
@Cron('0 2 * * *')  // 2:00 AM hàng ngày
async computeRecommendations() {
  const startTime = Date.now();
  this.logger.log('Starting recommendation computation...');

  await this.recommendationsService.computeAllSimilarities();

  const elapsed = (Date.now() - startTime) / 1000;
  this.logger.log(`Recommendation computation finished in ${elapsed}s`);
}
```

`computeAllSimilarities()` thực hiện theo thứ tự:

1. **Content-Based** — Build tag vectors → pairwise cosine
2. **Collaborative** — Load enrollments map → pairwise jaccard
3. **Popularity** — Compute Wilson + time decay cho mọi published course
4. Insert/Update bảng `CourseSimilarity` (delete cũ + insert mới)

### 3.9 Backend — Sửa lỗi tuần này

Trong quá trình tích hợp em phát hiện 2 vấn đề:

**Vấn đề 1: Cron handler trống**

Cron đã được register nhưng không thực sự gọi `computeAllSimilarities()` — handler bị skeleton. Kết quả: bảng `CourseSimilarity` luôn rỗng → API gọi đến phải fallback về popularity, mất hết giá trị của 2 thuật toán còn lại.

```typescript
// ❌ Trước
@Cron('0 2 * * *')
async computeRecommendations() {
  // TODO: implement
}

// ✅ Sau
@Cron('0 2 * * *')
async computeRecommendations() {
  await this.recommendationsService.computeAllSimilarities();
}
```

**Vấn đề 2: Popularity thiếu course fields**

`getPopularCourses()` chỉ trả `{ courseId, score }` — frontend nhận xong phải gọi thêm 1 round-trip nữa để lấy thông tin khóa học (title, thumbnail, instructor...).

```typescript
// ❌ Trước
async getPopularCourses(limit: number) {
  return this.prisma.coursePopularity.findMany({
    select: { courseId: true, score: true },
    orderBy: { score: 'desc' },
    take: limit,
  });
}

// ✅ Sau — JOIN với Course
async getPopularCourses(limit: number) {
  const popular = await this.prisma.coursePopularity.findMany({
    include: {
      course: {
        include: {
          instructor: { select: { fullName: true, avatarUrl: true } },
          category: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { score: 'desc' },
    take: limit,
  });
  return popular.map((p) => ({ ...p.course, popularityScore: p.score }));
}
```

**Cải tiến phụ — tăng tần suất cleanup cron:**

Trong lúc rà soát các cron jobs, em cũng tăng tần suất cleanup token/upload tạm từ 1 ngày → **6 giờ** một lần để giảm dung lượng database trên Neon (free tier 0.5GB).

### 3.10 Shared — Service và Hooks

Trong package `shared-hooks`, em thêm service và TanStack Query hooks:

```typescript
// recommendation.service.ts
export type RecommendationContext =
  | 'homepage'
  | 'course_detail'
  | 'post_purchase'
  | 'post_complete';

export const recommendationService = {
  getRecommendations: (params: {
    context: RecommendationContext;
    courseId?: string;
    limit?: number;
  }) => apiClient.get<Course[]>('/recommendations', { params }),
};

// queries/use-recommendations.ts
export function useRecommendations(context: RecommendationContext, courseId?: string) {
  return useQuery({
    queryKey: ['recommendations', context, courseId],
    queryFn: () => recommendationService.getRecommendations({ context, courseId }),
    staleTime: 5 * 60 * 1000, // 5 phút — recommendations không đổi nhanh
  });
}
```

### 3.11 Frontend — Tích hợp 4 trang

Em thiết kế component reusable `RecommendationSection` và sử dụng ở 4 trang khác nhau:

| Trang             | Context         | Heading hiển thị      |
| ----------------- | --------------- | --------------------- |
| Trang chủ         | `homepage`      | "Có thể bạn quan tâm" |
| Chi tiết khóa học | `course_detail` | "Khóa học tương tự"   |
| Khóa học của tôi  | `post_complete` | "Tiếp tục với"        |
| Chi tiết đơn hàng | `post_purchase` | "Học viên cũng mua"   |

**Component design:**

```tsx
<RecommendationSection
  context="course_detail"
  courseId={course.id}
  heading={t('recommendations.similarCourses')}
  emptyState={<RecommendationsEmpty />}
/>
```

Component xử lý:

- Loading state với skeleton cards
- Empty state khi chưa có dữ liệu (cron chưa chạy lần đầu hoặc khóa quá mới)
- Error state với retry button
- Responsive grid (1 col mobile → 2 cols tablet → 4 cols desktop)

### 3.12 Luồng end-to-end hoàn chỉnh

```
[Cron 2AM hàng ngày]
   │
   ├──→ computeAllSimilarities()
   │      ├── Content-Based (cosine on tag vectors)
   │      ├── Collaborative (jaccard on enrollment sets)
   │      └── Popularity (wilson + time decay)
   │             ↓
   │      Insert/Update CourseSimilarity + CoursePopularity
   │
[Học viên mở trang chi tiết khóa học]
   │
   ├──→ React component RecommendationSection mount
   │      ↓
   │      useRecommendations('course_detail', courseId)
   │      ↓
   │      GET /api/recommendations?context=course_detail&courseId=xxx
   │      ↓
   │      RecommendationsService.getRecommendations():
   │        - context = course_detail → gọi getContentBased()
   │        - SELECT * FROM course_similarities
   │          WHERE source_course_id = $1 AND algorithm = 'CONTENT'
   │          ORDER BY score DESC LIMIT 8
   │        - JOIN với Course để lấy full fields
   │        - Nếu rỗng → fallback popularity
   │      ↓
   │      Trả về 8 khóa học tương tự (full data)
   │
   └── Render 8 CourseCard trong grid responsive
```

### 3.13 Tests cho module Recommendations

Tổng cộng **22 unit tests** cho module:

| Test suite                        | Số tests | Phạm vi                                               |
| --------------------------------- | -------- | ----------------------------------------------------- |
| `recommendations.service.spec.ts` | 7        | Context routing, fallback, hybrid combination         |
| `cosine-similarity.spec.ts`       | 7        | Edge cases (empty, identical, orthogonal vectors)     |
| `jaccard-similarity.spec.ts`      | 4        | Set operations, edge cases (empty intersection/union) |
| `wilson-score.spec.ts`            | 4        | Confidence interval, low/high sample sizes            |

---

## 4. NÂNG CẤP UI/UX — PHASE 7

### 4.1 Color System v2 — Migration sang OKLCH

**Vấn đề với hệ màu cũ (hex/HSL):**

Hệ màu cũ dùng Tailwind defaults với hex codes. Khi cần dark mode hoặc tạo gradients, phải tự đoán giá trị màu — rất khó để giữ độ sáng đồng đều giữa các hue (ví dụ: blue-500 và yellow-500 có perceptual lightness khác nhau).

**Giải pháp — OKLCH:**

OKLCH (Lightness, Chroma, Hue) là không gian màu **perceptually uniform** — nghĩa là hai màu có cùng `L` sẽ trông sáng như nhau dù khác hue. Tailwind 4 và CSS hiện đại hỗ trợ native.

**Primary color mới:**

```css
--color-primary: oklch(0.58 0.22 265); /* Indigo */
```

Thay thế cho `#2563eb` (blue-600). Indigo có cảm giác hiện đại, "tech-y" hơn, phù hợp với platform giáo dục.

**Multi-accent palette:**

Thay vì chỉ dùng 1 màu primary cho mọi thứ, em định nghĩa 6 accent màu để tạo điểm nhấn cho stats cards, illustrations:

| Token              | OKLCH                  | Mục đích   |
| ------------------ | ---------------------- | ---------- |
| `--accent-violet`  | `oklch(0.62 0.22 295)` | Học viên   |
| `--accent-pink`    | `oklch(0.68 0.20 350)` | Doanh thu  |
| `--accent-cyan`    | `oklch(0.72 0.15 200)` | Lượt xem   |
| `--accent-emerald` | `oklch(0.65 0.18 155)` | Hoàn thành |
| `--accent-amber`   | `oklch(0.78 0.16 75)`  | Cảnh báo   |
| `--accent-rose`    | `oklch(0.65 0.22 15)`  | Yêu thích  |

**Background "lifted card" pattern:**

- Light mode: background `oklch(0.985 0.004 265)` (off-white có hue indigo nhẹ), card pure white → tạo hiệu ứng "nâng" card lên
- Dark mode: card surfaces sáng hơn background +0.04 → cùng hiệu ứng nâng nhưng theo chiều ngược lại

**Shadow system 6 cấp với primary tint:**

```css
--shadow-xs: 0 1px 2px oklch(0.58 0.22 265 / 0.05);
--shadow-sm: 0 2px 4px oklch(0.58 0.22 265 / 0.08);
--shadow-md: 0 4px 8px oklch(0.58 0.22 265 / 0.1);
--shadow-lg: 0 8px 16px oklch(0.58 0.22 265 / 0.12);
--shadow-xl: 0 16px 32px oklch(0.58 0.22 265 / 0.15);
--shadow-2xl: 0 32px 64px oklch(0.58 0.22 265 / 0.2);

--glow-sm: 0 0 16px oklch(0.58 0.22 265 / 0.3);
--glow-md: 0 0 24px oklch(0.58 0.22 265 / 0.35);
--glow-lg: 0 0 32px oklch(0.58 0.22 265 / 0.4);
```

Thêm hue indigo vào shadow giúp shadow không bị "xám chết" mà có chiều sâu sống động hơn.

**Lưu ý quan trọng:** Tất cả semantic tokens (`primary`, `secondary`, `muted`, `accent`...) **giữ nguyên tên** — chỉ thay giá trị OKLCH bên trong. Vì vậy không có **breaking change** nào trong code component đang sử dụng các token này.

### 4.2 Component Polish

**Button:**

- Hover: `-translate-y-px` (nâng lên 1px) + shadow tăng
- Active: `scale-[0.98]` (nhấn xuống nhẹ)
- Variant mới: `gradient` — background gradient từ primary → violet

**Card:**

- Border opacity giảm xuống 60% — mềm mại hơn
- Default shadow: `shadow-xs` thay vì không có shadow

**Input:**

- Focus ring rộng hơn: `ring-4 ring/40` thay vì `ring-2 ring/60` — cảm giác "soft" hơn
- Border đổi màu sang primary khi focus
- Hover state cho border (trước đây không có)

**Skeleton:**

- Đổi từ `animate-pulse` (fade in/out) sang **shimmer gradient** (gradient di chuyển qua)
- Tạo cảm giác "loading có hướng" tự nhiên hơn

### 4.3 Page Polish

**Student Homepage:**

- Hero section dùng utility `bg-mesh-1` + 3 colored blobs (violet, cyan, pink) với `blur-3xl`
- Title gradient text (`text-gradient` utility): from primary → violet
- Stat numbers: gradient text với màu khác nhau cho mỗi stat
- Course cards: hover glow (shadow tinted với primary)

**Student My Learning:**

- Stats cards với multi-accent icons (mỗi card 1 màu accent khác nhau)
- Hover lift trên stats cards

**Management Stat Cards:**

- Mỗi card có icon background dùng 1 màu accent (emerald/cyan/primary/amber/violet)
- Icon scale lên khi hover card

### 4.4 Course Detail UX — Share + Wishlist

Trên trang chi tiết khóa học, hai nút Share và Wishlist trước đây chỉ là UI tĩnh. Tuần này em wire up logic:

**Nút Share:**

```typescript
const handleShare = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success(t('linkCopied'));
  } catch {
    toast.error(t('linkCopyFailed'));
  }
};
```

Đơn giản nhưng hiệu quả — copy URL hiện tại và hiển thị toast feedback.

**Nút Wishlist:**

```typescript
const { data: wishlist } = useWishlist({ enabled: isAuthenticated });
const addMutation = useAddToWishlist();
const removeMutation = useRemoveFromWishlist();

const isInWishlist = wishlist?.some((w) => w.courseId === courseId);

const handleWishlist = () => {
  if (!isAuthenticated) {
    router.push(`/login?redirect=${pathname}`);
    return;
  }
  if (isInWishlist) {
    removeMutation.mutate(courseId, {
      onSuccess: () => toast.success(t('removedFromWishlist')),
    });
  } else {
    addMutation.mutate(courseId, {
      onSuccess: () => toast.success(t('addedToWishlist')),
    });
  }
};
```

**Visual feedback:** Heart icon `fill-current text-destructive` (đỏ tô đặc) khi đã thêm vào wishlist.

**Phòng tránh 401 spam:** `useWishlist` nhận `enabled: isAuthenticated` — guest không gọi API protected.

### 4.5 Auth Layout — Logo Clickable

Vấn đề nhỏ: trên các trang login/register, người dùng không có cách nào quay về trang chủ ngoài bấm Back trên trình duyệt. Sửa bằng cách wrap logo trong `<Link href="/">`:

```tsx
<Link href="/" className="flex items-center gap-2">
  <GraduationCap className="text-primary h-8 w-8" />
  <span className="text-2xl font-bold">SSLM</span>
</Link>
```

**Quyết định không thêm `aria-label`:** Text "SSLM" hiển thị bên cạnh icon đã đủ context cho screen reader. Thêm aria-label sẽ tạo gánh nặng dịch i18n không cần thiết.

### 4.6 Bug Fix — QnA List Spacing

Trang danh sách Q&A có khoảng cách giữa các item bị mất khi hiển thị. Nguyên nhân: dùng `space-y-3` trên container chứa các `<Link>`.

**Lý do:** Tailwind `space-y-*` thực chất là `margin-top` áp dụng cho **non-first child**. Khi children là inline elements (như `<a>` từ `<Link>`), margin-top không có hiệu lực vì inline elements bỏ qua vertical margin.

**Giải pháp:**

```tsx
// ❌ Trước
<div className="space-y-3">
  {questions.map((q) => <Link href={...}>...</Link>)}
</div>

// ✅ Sau
<div className="flex flex-col gap-4">
  {questions.map((q) => <Link href={...}>...</Link>)}
</div>
```

Flexbox `gap` hoạt động trên mọi loại child, không phụ thuộc display mode.

**Bài học rút ra:** Với danh sách render `.map()` mà children có thể là inline (Link, span, a), luôn ưu tiên `flex flex-col gap-*` thay vì `space-y-*`.

---

## 5. ADMIN ANALYTICS — 3 BUG FIXES VÀ AGGREGATION

Trang admin analytics hiển thị sai dữ liệu trên cả 3 phương diện. Em fix tổng cộng 3 bugs trong 1 commit (`b7dc5ca`).

### 5.1 Bug 1 — Frontend Data Accessor

**Triệu chứng:** Dashboard hiện toàn `undefined`, charts trống.

**Nguyên nhân:** API client wrap response trong envelope `{ data, meta }`, nhưng frontend access trực tiếp `dashboardData.overview` thay vì `dashboardData.data.overview`.

**Sửa:**

```typescript
// Helper unwrap
function unwrapSnapshots<T>(response: { data: T } | undefined): T | undefined {
  return response?.data;
}

// Sử dụng
const dashboardData = unwrapSnapshots(rawDashboardData);
const overview = dashboardData?.overview;
```

### 5.2 Bug 2 — Cron Data Shape Mismatch

**Triệu chứng:** Charts users và revenue hiện đường thẳng = 0.

**Nguyên nhân:** Cron daily snapshot ghi data với shape khác với shape mà chart đọc:

| Type            | Cron ghi              | Chart đọc                   | Kết quả         |
| --------------- | --------------------- | --------------------------- | --------------- |
| `DAILY_USERS`   | `{ count: 150 }`      | `{ students, instructors }` | `undefined` → 0 |
| `DAILY_REVENUE` | `{ amount: 5000000 }` | `{ revenue }`               | `undefined` → 0 |

**Sửa cron:**

```typescript
// DAILY_USERS — split theo role
const [students, instructors] = await Promise.all([
  this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: ... } } }),
  this.prisma.user.count({ where: { role: 'INSTRUCTOR', createdAt: { gte: ... } } }),
]);
data = { students, instructors };

// DAILY_REVENUE — đổi tên field
const revenue = await this.prisma.order.aggregate({ _sum: { totalAmount: true }, ... });
data = { revenue: revenue._sum.totalAmount ?? 0 };
```

Đồng thời em thêm comment trong cron mô tả expected shape cho từng type — tránh tái diễn lỗi này trong tương lai.

### 5.3 Bug 3 — Range Filter Trả về Dữ liệu Giống nhau

**Triệu chứng:** Các filter "Last 30 days", "Last 3 months", "Last 12 months" hiện chart **giống hệt nhau**.

**Nguyên nhân kép:**

1. **Seed data**: Chỉ có 30 ngày dữ liệu → 3 months và 12 months đều trả về 30 snapshots
2. **Backend không aggregate**: Nếu trả về 365 daily points, chart 12 tháng sẽ chật cứng và khó đọc

**Giải pháp — Adaptive Granularity:**

Em thêm logic granularity vào `admin-analytics.service.ts`:

```typescript
function getGranularity(days: number): 'daily' | 'weekly' | 'monthly' {
  if (days <= 31) return 'daily';
  if (days <= 92) return 'weekly';
  return 'monthly';
}

async getSnapshots(type: SnapshotType, days: number) {
  const granularity = getGranularity(days);
  const raw = await this.prisma.analyticsSnapshot.findMany({ ... });

  if (granularity === 'daily') return raw;
  return aggregateByBucket(raw, granularity);
}
```

**Aggregation logic:**

- **Weekly**: Group theo ISO week (bắt đầu từ Thứ 2, tính theo UTC)
- **Monthly**: Group theo `YYYY-MM` UTC
- Sum tất cả numeric fields trong cùng bucket

**Frontend `formatDateLabel`** thích ứng theo range:

- 12 months: `MM/YYYY` (ví dụ "01/2026")
- Khác: `DD/MM` (ví dụ "15/03")

**Seed mở rộng:** Từ 30 ngày → **365 ngày** để test đầy đủ các range. Seed dùng `upsert` nên non-destructive.

### 5.4 Bài học rút ra

1. **API envelope**: Mọi `useQuery` nên unwrap đúng cách — dùng generic types để compiler bắt lỗi
2. **Data shape contracts**: Cron và chart phải document shape rõ ràng và đồng bộ
3. **Visualizations cần aggregation**: Bất kỳ dashboard nào hiện > 31 ngày đều cần aggregation backend, không nên trả raw points
4. **`enabled` cho protected queries**: Mọi query gọi endpoint cần auth phải có `enabled: isAuthenticated` để tránh 401 spam khi guest mở trang

---

## 6. KẾT QUẢ

| Hạng mục                     | Số commits | Tests mới | Ghi chú                                  |
| ---------------------------- | ---------- | --------- | ---------------------------------------- |
| Question Bank fixes          | 4          | 25        | Per-bank tags, difficulty, import filter |
| Recommendations integration  | 3          | 0         | Frontend integration, cron fix           |
| UI Refresh (Phase 7.1)       | 4          | 0         | OKLCH, multi-accent, component polish    |
| Course Detail UX (Phase 7.2) | 2          | 0         | Share, wishlist, auth logo link          |
| Admin Analytics (Phase 7.3)  | 1          | 0         | 3 bugs + aggregation                     |
| QnA spacing fix              | 1          | 0         | Flex gap thay vì space-y                 |

**Tổng tests dự án:** ~691 tests passing (tăng từ 666 sau khi thêm Question Bank tag tests).

---

## 7. KẾ HOẠCH TUẦN TIẾP THEO

- **Testing toàn diện**: Viết E2E tests cho các luồng chính (đăng ký → mua khóa → học → hoàn thành → nhận chứng chỉ)
- **Performance optimization**: Phân tích bottleneck (lazy load, image optimization, Lighthouse audit)
- **Deployment chuẩn bị production**:
  - Frontend lên Vercel (2 projects: student + management)
  - Backend lên Render.com
  - Database trên Neon.tech (production branch)
  - Cấu hình env, domain, CORS
- **Chuẩn bị slide và demo** cho buổi báo cáo bảo vệ

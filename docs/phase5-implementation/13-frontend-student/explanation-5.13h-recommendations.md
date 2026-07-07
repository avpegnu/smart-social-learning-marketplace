# Giải thích chi tiết: Hệ thống Gợi ý Khóa học (Recommendations)

---

## 1. Tổng quan — Hệ thống hoạt động thế nào?

Hệ thống gợi ý có **2 giai đoạn hoàn toàn tách biệt**:

```
┌─────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 1: TÍNH TOÁN TRƯỚC (Offline — Cron 4h sáng)        │
│                                                                 │
│  Cron Job (4 AM) ──► ContentBasedService.computeSimilarity()    │
│                  ──► CollaborativeService.computeSimilarity()    │
│                  ──► computeHybrid() (blend 50/50)              │
│                  ──► Lưu vào bảng CourseSimilarity              │
│                                                                 │
│  Kết quả: Ma trận N×N điểm tương đồng giữa mọi cặp khóa học  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GIAI ĐOẠN 2: PHỤC VỤ REALTIME (Online — Khi user request)    │
│                                                                 │
│  GET /recommendations?context=X ──► Đọc CourseSimilarity       │
│                                 ──► Lọc theo enrolled courses   │
│                                 ──► Trả về top N courses        │
│                                                                 │
│  Thời gian: < 100ms (chỉ đọc DB, không tính toán)             │
└─────────────────────────────────────────────────────────────────┘
```

**Tại sao tách 2 giai đoạn?**
- Tính similarity giữa N khóa học = O(N²) phép so sánh → tốn thời gian
- Nếu tính realtime mỗi request → user phải chờ vài giây
- Tính trước 1 lần/ngày, lưu kết quả → phục vụ request chỉ cần đọc DB (< 100ms)

---

## 2. Giai đoạn 1: Tính toán trước (Chạy khi nào?)

### Khi nào chạy?

```
Cron: '0 4 * * *' = 4:00 sáng mỗi ngày
```

Server tự động chạy lúc 4h sáng (giờ server), khi traffic thấp nhất. Mỗi ngày chạy 1 lần.

### Chạy cái gì?

Gọi `RecommendationsService.computeAllSimilarities()`:

```typescript
async computeAllSimilarities() {
  await this.contentBased.computeSimilarity();   // Bước 1: Tính theo tags
  await this.collaborative.computeSimilarity();  // Bước 2: Tính theo enrollment
  await this.computeHybrid();                    // Bước 3: Blend 2 kết quả
}
```

### Lưu ở đâu?

Bảng `CourseSimilarity` trong PostgreSQL:

```
┌──────────────────────────────────────────────────────────────┐
│ CourseSimilarity                                             │
├──────────┬─────────────────┬───────┬─────────────────────────┤
│ courseId  │ similarCourseId │ score │ algorithm               │
├──────────┼─────────────────┼───────┼─────────────────────────┤
│ course_1 │ course_2        │ 0.67  │ CONTENT                 │
│ course_2 │ course_1        │ 0.67  │ CONTENT     (2 chiều!)  │
│ course_1 │ course_3        │ 0.33  │ CONTENT                 │
│ course_1 │ course_2        │ 0.50  │ COLLABORATIVE           │
│ course_1 │ course_2        │ 0.58  │ HYBRID      (blend)     │
└──────────┴─────────────────┴───────┴─────────────────────────┘

Unique key: (courseId, similarCourseId, algorithm)
Index: (courseId, score DESC) → để query top N nhanh
```

---

## 3. Ba thuật toán chi tiết

### 3.1 Content-Based Filtering (Lọc theo nội dung)

**Ý tưởng:** Hai khóa học có nhiều tags giống nhau → chúng tương tự nhau.

**Thuật toán: Cosine Similarity trên vector tags**

```
Bước 1: Thu thập tất cả tags trong hệ thống
  Tags = [JavaScript, React, Python, Machine Learning, CSS, Node.js]

Bước 2: Biểu diễn mỗi khóa học thành vector nhị phân
  Course A "React Mastery":    [1, 1, 0, 0, 1, 0]  (có JS, React, CSS)
  Course B "Next.js Fullstack": [1, 1, 0, 0, 0, 1]  (có JS, React, Node.js)
  Course C "ML with Python":   [0, 0, 1, 1, 0, 0]  (có Python, ML)

Bước 3: Tính cosine similarity cho từng cặp
  cos(A, B) = (A·B) / (|A| × |B|)
            = (1×1 + 1×1 + 0×0 + 0×0 + 1×0 + 0×1) / (√3 × √3)
            = 2 / 3 = 0.667 → Khá giống!

  cos(A, C) = (0 + 0 + 0 + 0 + 0 + 0) / (√3 × √2)
            = 0 → Hoàn toàn khác!

Bước 4: Lưu nếu score > 0.1 (ngưỡng lọc nhiễu)
  Lưu: A↔B score=0.667, algorithm=CONTENT
  Bỏ: A↔C score=0 (dưới ngưỡng)
```

**Code thực tế** (`content-based.service.ts`):

```typescript
// Mỗi tag là 1 chiều, mỗi khóa học là 1 vector
const allTagIds = [...new Set(courses.flatMap(c => c.courseTags.map(t => t.tagId)))];
const vectorA = allTagIds.map(t => tagsA.has(t) ? 1 : 0);  // [1,1,0,0,1,0]
const vectorB = allTagIds.map(t => tagsB.has(t) ? 1 : 0);  // [1,1,0,0,0,1]
const score = this.cosineSimilarity(vectorA, vectorB);       // 0.667
```

**Khi nào dùng:** Trang chi tiết khóa học ("Khóa học tương tự"), hoàn thành khóa học ("Học tiếp gì?")

---

### 3.2 Collaborative Filtering (Lọc cộng tác)

**Ý tưởng:** Nếu nhiều người đăng ký cả khóa A lẫn khóa B → chúng liên quan.
("Người mua khóa này cũng mua...")

**Thuật toán: Jaccard Similarity trên tập hợp users**

```
Bước 1: Thu thập ai đã đăng ký khóa nào
  Course A: {User1, User2, User3, User4}     ← 4 học viên
  Course B: {User1, User3, User5, User6}     ← 4 học viên
  Course C: {User7, User8}                   ← 2 học viên

Bước 2: Tính Jaccard cho từng cặp
  Jaccard(A, B) = |A ∩ B| / |A ∪ B|
                = |{User1, User3}| / |{User1,User2,User3,User4,User5,User6}|
                = 2 / 6 = 0.333

  Jaccard(A, C) = |{}| / |{User1..User4,User7,User8}|
                = 0 / 6 = 0.000 → Không liên quan

Bước 3: Lưu nếu score > 0
  Lưu: A↔B score=0.333, algorithm=COLLABORATIVE
```

**Tại sao dùng Jaccard thay vì Cosine?**
- Jaccard đo "mức độ trùng lặp" giữa 2 tập hợp → phù hợp với binary membership
- Không cần normalize, range tự nhiên [0,1]
- Dễ hiểu: "33% users đăng ký cả 2 khóa"

**Khi nào dùng:** Sau khi mua hàng ("Học viên cũng thích")

---

### 3.3 Popularity (Xếp hạng phổ biến)

**Ý tưởng:** Khóa học tốt + nhiều review + mới → xếp hạng cao.
Dùng làm **fallback** khi không có dữ liệu cá nhân hóa.

**Thuật toán: Wilson Score Lower Bound + Time Decay**

```
Vấn đề với rating trung bình:
  Course A: 5.0★ (1 review)   ← Có thật sự tốt hơn?
  Course B: 4.5★ (200 reviews) ← Đáng tin hơn nhiều!

Wilson Score giải quyết bằng cách tính "giới hạn dưới" của khoảng tin cậy 95%:
  Course A: Wilson = 0.21  (1 review → không chắc chắn → score thấp)
  Course B: Wilson = 0.82  (200 reviews → rất chắc chắn → score cao)

Kết hợp với Time Decay (khóa mới ưu tiên hơn):
  timeFactor = 1 / (1 + log₁₀(1 + days/30))

  Khóa 0 ngày tuổi:   timeFactor = 1.00
  Khóa 30 ngày tuổi:  timeFactor = 0.77
  Khóa 90 ngày tuổi:  timeFactor = 0.62
  Khóa 365 ngày tuổi: timeFactor = 0.47

Score cuối cùng:
  finalScore = wilsonScore × 0.7 + timeFactor × 0.3
  → Ưu tiên quality (70%) hơn freshness (30%)
```

**Khi nào dùng:**
- User chưa đăng nhập (anonymous)
- User chưa đăng ký khóa nào (cold start)
- Các algorithm khác trả về rỗng (fallback)

---

### 3.4 Hybrid (Kết hợp)

**Ý tưởng:** Blend Content-Based + Collaborative → kết quả tốt hơn cả 2.

```
hybridScore = contentScore × 0.5 + collaborativeScore × 0.5

Ví dụ:
  Course A → B:
    Content score  = 0.667 (tags giống nhau)
    Collab score   = 0.333 (users trùng lặp)
    Hybrid score   = 0.667×0.5 + 0.333×0.5 = 0.500

  Lưu: A→B score=0.500, algorithm=HYBRID
```

**Khi nào dùng:** Homepage cho user đã đăng nhập ("Gợi ý cho bạn")

---

## 4. Giai đoạn 2: Phục vụ request (Luồng khi user mở trang)

### API Endpoint

```
GET /api/recommendations?context=homepage&courseId=xxx&limit=4
```

| Param | Giá trị | Mặc định |
|-------|---------|----------|
| `context` | `homepage`, `course_detail`, `post_purchase`, `post_complete` | `homepage` |
| `courseId` | ID khóa học (bắt buộc cho `course_detail`) | — |
| `limit` | 1-20 | 10 |

### Luồng xử lý theo context

```
User gửi request
     │
     ▼
┌─ User đã đăng nhập? ──────────────────────────────────────┐
│                                                             │
│  KHÔNG ──► PopularityService.getPopularCourses(limit)       │
│            (Wilson Score + Time Decay, tính realtime)        │
│                                                             │
│  CÓ ──► Lấy danh sách courseId đã enrolled                 │
│     │                                                       │
│     ├─ context = "homepage"                                 │
│     │   └► Đọc CourseSimilarity WHERE algorithm=HYBRID      │
│     │      WHERE courseId IN (enrolled)                      │
│     │      AND similarCourseId NOT IN (enrolled) ← loại đã học
│     │      ORDER BY score DESC, LIMIT N                     │
│     │      Nếu rỗng → fallback Popularity                  │
│     │                                                       │
│     ├─ context = "course_detail" (cần courseId param)        │
│     │   └► Đọc CourseSimilarity WHERE algorithm=CONTENT     │
│     │      WHERE courseId = param.courseId                   │
│     │      AND similarCourseId NOT IN (enrolled)            │
│     │      ORDER BY score DESC, LIMIT N                     │
│     │                                                       │
│     ├─ context = "post_purchase"                            │
│     │   └► Đọc CourseSimilarity WHERE algorithm=COLLABORATIVE
│     │      WHERE courseId IN (enrolled)                      │
│     │      AND similarCourseId NOT IN (enrolled)            │
│     │      ORDER BY score DESC, LIMIT N                     │
│     │                                                       │
│     └─ context = "post_complete"                            │
│         └► Lấy courseId cuối cùng đã enrolled               │
│            Đọc CourseSimilarity WHERE algorithm=CONTENT     │
│            WHERE courseId = lastEnrolled                     │
│            AND similarCourseId NOT IN (enrolled)            │
│            ORDER BY score DESC, LIMIT N                     │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
Trả về: [{ id, title, slug, thumbnailUrl, price, avgRating,
           score, reason, instructor, _count }]
```

### Điểm quan trọng: Loại trừ khóa đã học

Mọi query đều có điều kiện:
```sql
WHERE similarCourseId NOT IN (enrolled_course_ids)
```
→ Không gợi ý khóa mà user đã đăng ký rồi.

---

## 5. Frontend hiển thị như thế nào?

### 5.1 Component Architecture

```
RecommendationSection (reusable)
├── Props: context, courseId?, limit, title, subtitle
├── Hook: useRecommendations(context, { courseId, limit })
├── Loading: 4 shimmer skeleton cards
├── Empty: ẩn section hoàn toàn
└── Data: Grid CourseCard (1 col → 2 col → 4 col responsive)
```

Một component duy nhất `RecommendationSection` dùng ở tất cả 4 trang. Chỉ thay đổi prop `context` → backend tự chọn algorithm.

### 5.2 Bốn vị trí tích hợp

```
┌─────────────────────────────────────────────────────────────┐
│  1. HOMEPAGE (/) — Chỉ hiện khi đã đăng nhập               │
│                                                             │
│  ┌─ Hero Section ─────────────────────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Categories ───────────────────────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Popular Courses (existing) ───────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ New Courses (existing) ───────────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ ★ GỢI Ý CHO BẠN ★ ─────────────────────────────────┐  │
│  │  context="homepage" → Hybrid algorithm                 │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │
│  │  │Card│ │Card│ │Card│ │Card│  ← CourseCard grid       │  │
│  │  └────┘ └────┘ └────┘ └────┘                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Why Us (existing) ────────────────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│  2. COURSE DETAIL (/courses/[slug]) — Mọi user             │
│                                                             │
│  ┌─ Course Info ──────────────────────────────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Tabs: Overview | Content | Reviews ───────────────────┐ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ ★ KHÓA HỌC TƯƠNG TỰ ★ ─────────────────────────────┐  │
│  │  context="course_detail" courseId={course.id}           │  │
│  │  → Content-based algorithm (tags giống nhau)           │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │
│  │  │Card│ │Card│ │Card│ │Card│                          │  │
│  │  └────┘ └────┘ └────┘ └────┘                         │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│  3. ORDER DETAIL (/orders/[orderId]) — Sau khi mua          │
│                                                             │
│  ┌─ Order Confirmation ──────────────────────────────────┐  │
│  │  ✓ Đơn hàng thành công!                               │  │
│  │  Items: Course A, Course B                             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ ★ HỌC VIÊN CŨNG THÍCH ★ ────────────────────────────┐  │
│  │  context="post_purchase"                               │  │
│  │  → Collaborative algorithm (enrollment overlap)        │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │
│  │  │Card│ │Card│ │Card│ │Card│                          │  │
│  │  └────┘ └────┘ └────┘ └────┘                         │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│  4. MY LEARNING (/my-learning) — Đã đăng nhập               │
│                                                             │
│  ┌─ Stats + Streak ──────────────────────────────────────┐  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─ Tabs: In Progress | Completed | All ─────────────────┐  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ ★ HỌC TIẾP GÌ NỮA? ★ ──────────────────────────────┐  │
│  │  context="post_complete"                               │  │
│  │  → Content-based từ khóa cuối cùng đã enrolled        │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │  │
│  │  │Card│ │Card│ │Card│ │Card│                          │  │
│  │  └────┘ └────┘ └────┘ └────┘                         │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Loading & Empty States

```
Loading (đang fetch):
┌────────────────────────────────────────────┐
│  Gợi ý cho bạn                             │
│  ┌─shimmer─┐ ┌─shimmer─┐ ┌─shimmer─┐      │
│  │░░░░░░░░░│ │░░░░░░░░░│ │░░░░░░░░░│      │
│  │░░░░░░░░░│ │░░░░░░░░░│ │░░░░░░░░░│      │
│  └─────────┘ └─────────┘ └─────────┘      │
└────────────────────────────────────────────┘

Empty (không có gợi ý):
  → Section bị ẩn hoàn toàn, không hiện gì

Error (API lỗi):
  → Section bị ẩn, không hiện toast (non-critical feature)
```

### 5.4 Responsive Grid

```
Mobile (< 640px):   1 cột
Tablet (640-1024):  2 cột
Desktop (> 1024):   4 cột

<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {courses.map(course => <CourseCard key={course.id} ... />)}
</div>
```

---

## 6. Luồng end-to-end (Ví dụ cụ thể)

### Ví dụ: User Lan mở Homepage

```
Bối cảnh:
  - Lan đã đăng nhập
  - Lan đã enrolled: "React Basics" (tags: JS, React)
                     "CSS Mastery" (tags: CSS, Design)
  - Hệ thống có 5 khóa học khác

Timeline:

[4:00 AM hôm trước] Cron chạy computeAllSimilarities()
  1. ContentBased: So sánh tags giữa mọi cặp khóa
     - React Basics ↔ Next.js Course: score=0.67 (cùng JS, React)
     - React Basics ↔ Python ML:     score=0.00 (tags khác hoàn toàn)
     - CSS Mastery ↔ UI/UX Course:   score=0.50 (cùng CSS, Design)
     → Lưu vào CourseSimilarity (algorithm=CONTENT)

  2. Collaborative: So sánh users giữa mọi cặp khóa
     - React Basics & Next.js Course: 3 users chung / 8 total = 0.375
     - React Basics & Python ML:      0 users chung = 0.000
     → Lưu vào CourseSimilarity (algorithm=COLLABORATIVE)

  3. Hybrid: Blend
     - React Basics → Next.js: 0.67×0.5 + 0.375×0.5 = 0.523
     - CSS Mastery → UI/UX:   0.50×0.5 + 0.00×0.5  = 0.250
     → Lưu vào CourseSimilarity (algorithm=HYBRID)

[14:00 PM] Lan mở Homepage
  Browser: GET /api/recommendations?context=homepage&limit=4
  Header: Authorization: Bearer <Lan's token>

  Backend:
    1. Parse user ID từ JWT → userId = "lan_id"
    2. Query enrolled courses: ["react_basics_id", "css_mastery_id"]
    3. context = "homepage" → dùng HYBRID algorithm
    4. Query:
       SELECT * FROM CourseSimilarity
       WHERE courseId IN ('react_basics_id', 'css_mastery_id')
         AND similarCourseId NOT IN ('react_basics_id', 'css_mastery_id')
         AND algorithm = 'HYBRID'
       ORDER BY score DESC
       LIMIT 4

    5. Kết quả:
       [
         { course: "Next.js Fullstack",  score: 0.523, reason: "Recommended for you" },
         { course: "UI/UX Design",       score: 0.250, reason: "Recommended for you" },
         { course: "Advanced React",     score: 0.180, reason: "Recommended for you" },
       ]

    6. Trả về 3 courses (chỉ có 3 kết quả, không đủ 4)

  Frontend:
    1. useRecommendations('homepage', { limit: 4 }) nhận data
    2. data.length = 3 > 0 → hiển thị section
    3. Render:
       ┌──────────────────────────────────────────┐
       │  Gợi ý cho bạn                            │
       │  Dựa trên sở thích và lịch sử học tập     │
       │                                            │
       │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
       │  │ Next.js  │ │ UI/UX    │ │ Adv React│  │
       │  │ 4.5★ (12)│ │ 4.2★ (8) │ │ 4.8★ (5) │  │
       │  │ 299.000đ │ │ 199.000đ │ │ 399.000đ │  │
       │  └──────────┘ └──────────┘ └──────────┘  │
       └──────────────────────────────────────────┘
```

---

## 7. Fallback Chain (Xử lý edge cases)

```
User request recommendations
         │
         ├─ Chưa đăng nhập?
         │   └► Popularity (Wilson + Time Decay)
         │
         ├─ Đã đăng nhập nhưng chưa enroll khóa nào?
         │   └► Popularity (cold start problem)
         │
         ├─ Đã enroll nhưng Hybrid trả về rỗng?
         │   └► Popularity (ma trận chưa có dữ liệu)
         │
         ├─ context=course_detail nhưng thiếu courseId?
         │   └► Popularity
         │
         ├─ context=post_complete nhưng enrollments rỗng?
         │   └► Popularity
         │
         └─ Tất cả courses đều đã enrolled?
             └► Trả về [] → Frontend ẩn section
```

**Popularity là fallback cuối cùng** — luôn hoạt động vì chỉ cần có courses published.

---

## 8. So sánh 3 thuật toán

| Tiêu chí | Content-Based | Collaborative | Popularity |
|----------|---------------|---------------|------------|
| **Input** | Tags khóa học | Enrollment users | Rating + Reviews |
| **Thuật toán** | Cosine Similarity | Jaccard Similarity | Wilson Score + Time Decay |
| **Ưu điểm** | Không cần data user | Phát hiện pattern ẩn | Luôn hoạt động |
| **Nhược điểm** | Chỉ gợi ý "giống" | Cần nhiều users | Không cá nhân hóa |
| **Cold start?** | Cần tags | Cần enrollments | Không cần gì |
| **Pre-compute** | Có (daily) | Có (daily) | Không (realtime) |
| **Context phù hợp** | course_detail, post_complete | post_purchase | anonymous, fallback |

---

## 9. Database Models

```prisma
model CourseSimilarity {
  id              String              @id @default(cuid())
  courseId         String              @map("course_id")
  similarCourseId  String              @map("similar_course_id")
  score            Float               // 0.0 → 1.0
  algorithm        SimilarityAlgorithm // CONTENT | COLLABORATIVE | HYBRID
  createdAt        DateTime            @default(now()) @map("created_at")

  course          Course @relation("source_course", ...)
  similarCourse   Course @relation("similar_course", ...)

  @@unique([courseId, similarCourseId, algorithm])
  @@index([courseId, score(sort: Desc)])
  @@map("course_similarities")
}

enum SimilarityAlgorithm {
  CONTENT        // Tag-based cosine similarity
  COLLABORATIVE  // Enrollment-based Jaccard
  HYBRID         // Blend 50/50
}
```

---

## 10. Performance

| Metric | Giá trị |
|--------|---------|
| Pre-compute (100 courses) | ~2 giây |
| Pre-compute (1000 courses) | ~1 phút |
| API response time | < 100ms |
| Storage (100 courses, 3 algos) | ~30K rows |
| Client cache (staleTime) | 5 phút |
| Cron schedule | Mỗi ngày 4:00 AM |

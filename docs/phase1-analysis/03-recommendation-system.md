# 3. HỆ GỢI Ý KHÓA HỌC — Thuật toán (Không dùng AI/ML nặng)

## 3.1 Tổng quan: Hybrid Recommendation

Kết hợp 3 thuật toán đơn giản nhưng hiệu quả, mỗi thuật toán cho ra 1 danh sách → trộn lại bằng weighted score.

```
                    ┌─────────────────────────┐
                    │   HYBRID RECOMMENDER    │
                    │                         │
                    │  Final Score =          │
                    │    w1 × CB_score  +     │
                    │    w2 × CF_score  +     │
                    │    w3 × POP_score       │
                    │                         │
                    │  w1=0.4, w2=0.4, w3=0.2 │
                    └────┬───────┬───────┬────┘
                         │       │       │
              ┌──────────┘       │       └──────────┐
              ▼                  ▼                  ▼
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │ Content-Based   │ │Collaborative │ │ Popularity +    │
    │ Filtering       │ │ Filtering    │ │ Trending        │
    │                 │ │              │ │                 │
    │ "Khóa giống    │ │ "Người giống │ │ "Khóa hot      │
    │  khóa bạn đã   │ │  bạn cũng    │ │  đang trending" │
    │  học"           │ │  học khóa    │ │                 │
    │                 │ │  này"        │ │                 │
    │ Cosine          │ │ Jaccard      │ │ Wilson Score    │
    │ Similarity      │ │ Similarity   │ │ + Time Decay   │
    └─────────────────┘ └──────────────┘ └─────────────────┘
```

---

## 3.2 Thuật toán 1: Content-Based Filtering (Cosine Similarity)

### Ý tưởng

> "Nếu bạn thích khóa React, thì khóa Next.js cũng có nội dung tương tự → gợi ý!"

### Cách hoạt động

**Bước 1: Tạo Feature Vector cho mỗi khóa học**

Mỗi khóa học được biểu diễn bằng 1 vector dựa trên tags/categories:

```
Tags toàn hệ thống: [JavaScript, React, Node.js, Python, SQL, CSS, TypeScript, ...]

Khóa "React Mastery":     [1, 1, 0, 0, 0, 1, 1, ...]  (có JS, React, CSS, TS)
Khóa "Next.js Full":      [1, 1, 1, 0, 0, 0, 1, ...]  (có JS, React, Node, TS)
Khóa "Python for Data":   [0, 0, 0, 1, 1, 0, 0, ...]  (có Python, SQL)
```

**Bước 2: Tạo User Profile Vector**

Tổng hợp vectors của tất cả khóa user đã học/mua, nhân với rating:

```
User đã học:
  - "React Mastery" (rating: 5)  → vector × 5
  - "CSS Advanced" (rating: 4)   → vector × 4

User Profile = normalize(sum of weighted vectors)
             = [0.8, 0.7, 0, 0, 0, 0.9, 0.6, ...]
```

**Bước 3: Tính Cosine Similarity**

So sánh User Profile với mỗi khóa chưa mua:

```
                    A · B
cos(θ) = ─────────────────────
           ‖A‖ × ‖B‖

Trong đó:
  A = User Profile Vector
  B = Course Feature Vector
  · = dot product
  ‖ ‖ = magnitude (norm)

Kết quả: số từ 0→1, càng gần 1 = càng giống
```

**Ví dụ tính toán:**

```
User Profile:        A = [0.8, 0.7, 0.0, 0.0, 0.0, 0.9, 0.6]
Khóa "Next.js Full": B = [1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0]

A · B = 0.8×1 + 0.7×1 + 0×1 + 0 + 0 + 0.9×0 + 0.6×1 = 2.1
‖A‖  = √(0.64 + 0.49 + 0 + 0 + 0 + 0.81 + 0.36) = √2.30 = 1.517
‖B‖  = √(1 + 1 + 1 + 0 + 0 + 0 + 1) = √4 = 2.0

cos(θ) = 2.1 / (1.517 × 2.0) = 0.692 → Khá giống! → Gợi ý ✅
```

### Implementation (Pseudo-code)

```javascript
function contentBasedRecommend(userId, topN = 10) {
  // 1. Lấy khóa user đã học + rating
  const userCourses = getUserEnrolledCourses(userId); // [{courseId, rating}]

  // 2. Lấy tất cả tags unique trong hệ thống
  const allTags = getAllUniqueTags(); // ["JavaScript", "React", ...]

  // 3. Tạo User Profile Vector
  let userVector = new Array(allTags.length).fill(0);
  for (const { courseId, rating } of userCourses) {
    const courseTags = getCourseTags(courseId);
    for (const tag of courseTags) {
      const index = allTags.indexOf(tag);
      userVector[index] += rating; // weighted by rating
    }
  }
  userVector = normalize(userVector);

  // 4. Tính similarity với mỗi khóa chưa mua
  const candidates = getCoursesNotEnrolled(userId);
  const scores = candidates.map((course) => {
    const courseVector = buildCourseVector(course, allTags);
    return {
      courseId: course.id,
      score: cosineSimilarity(userVector, courseVector),
    };
  });

  // 5. Sort và trả top N
  return scores.sort((a, b) => b.score - a.score).slice(0, topN);
}

function cosineSimilarity(A, B) {
  const dotProduct = A.reduce((sum, a, i) => sum + a * B[i], 0);
  const magnitudeA = Math.sqrt(A.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(B.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}
```

### Ưu/Nhược điểm

- ✅ Đơn giản, dễ hiểu, dễ implement
- ✅ Hoạt động tốt ngay cả khi ít user (không cần nhiều data)
- ❌ Chỉ gợi ý khóa "giống" → Không khám phá được sở thích mới
- ❌ Phụ thuộc vào chất lượng tags

---

## 3.3 Thuật toán 2: Collaborative Filtering — Item-Based (Jaccard Similarity)

### Ý tưởng

> "Những người mua khóa A cũng thường mua khóa B → Nếu bạn mua A, gợi ý B!"

### Cách hoạt động

**Bước 1: Xây dựng ma trận User-Course**

```
              Course1  Course2  Course3  Course4  Course5
User 1:        ✅       ✅       —        ✅       —
User 2:        ✅       —        ✅       ✅       —
User 3:        —        ✅       —        ✅       ✅
User 4:        ✅       ✅       ✅       —        —
Target User:   ✅       ✅       —        —        —
```

**Bước 2: Tính Jaccard Similarity giữa các cặp Course**

```
                    |A ∩ B|
Jaccard(A, B) = ─────────────
                    |A ∪ B|

A = tập users đã mua Course A
B = tập users đã mua Course B

Ví dụ:
  Course1 buyers = {U1, U2, U4, Target}
  Course3 buyers = {U2, U4}

  Jaccard(C1, C3) = |{U2, U4}| / |{U1, U2, U4, Target}| = 2/4 = 0.50

  Course1 buyers = {U1, U2, U4, Target}
  Course4 buyers = {U1, U2, U3}

  Jaccard(C1, C4) = |{U1, U2}| / |{U1, U2, U3, U4, Target}| = 2/5 = 0.40
```

**Bước 3: Gợi ý cho Target User**

Target User đã mua {Course1, Course2}. Với mỗi khóa chưa mua:

```
Score(Course3) = Jaccard(C1,C3) + Jaccard(C2,C3)
               = 0.50 + 0.33 = 0.83

Score(Course4) = Jaccard(C1,C4) + Jaccard(C2,C4)
               = 0.40 + 0.50 = 0.90  → Gợi ý cao nhất!

Score(Course5) = Jaccard(C1,C5) + Jaccard(C2,C5)
               = 0.00 + 0.25 = 0.25
```

→ Kết quả: Gợi ý Course4 > Course3 > Course5

### Implementation (Pseudo-code)

```javascript
function collaborativeRecommend(userId, topN = 10) {
  // 1. Lấy khóa user đã mua
  const userCourses = getUserEnrolledCourseIds(userId); // [1, 2]

  // 2. Lấy tất cả khóa chưa mua
  const candidates = getAllCourseIds().filter((id) => !userCourses.includes(id));

  // 3. Với mỗi candidate, tính tổng Jaccard với các khóa đã mua
  const scores = candidates.map((candidateId) => {
    let totalSim = 0;
    for (const ownedId of userCourses) {
      totalSim += jaccardSimilarity(ownedId, candidateId);
    }
    return { courseId: candidateId, score: totalSim / userCourses.length };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, topN);
}

function jaccardSimilarity(courseA, courseB) {
  const buyersA = new Set(getUsersWhoBought(courseA));
  const buyersB = new Set(getUsersWhoBought(courseB));

  const intersection = [...buyersA].filter((u) => buyersB.has(u)).length;
  const union = new Set([...buyersA, ...buyersB]).size;

  return union === 0 ? 0 : intersection / union;
}
```

### Ưu/Nhược điểm

- ✅ Khám phá được sở thích mới (khóa khác lĩnh vực nhưng cùng nhóm user)
- ✅ Không cần phân tích nội dung khóa
- ❌ Cold-start problem: Khóa mới chưa ai mua → không gợi ý được
- ❌ Cần đủ lượng users để chính xác (>100 users)

---

## 3.4 Thuật toán 3: Popularity + Trending (Wilson Score + Time Decay)

### Ý tưởng

> "Giải quyết cold-start: Khi chưa biết gì về user → gợi ý khóa phổ biến + đang trending"

### Vấn đề với Average Rating

```
Khóa A: 5.0 sao (2 reviews)   → Có thật sự tốt?
Khóa B: 4.7 sao (500 reviews) → Đáng tin hơn nhiều!
```

Average rating không công bằng → Dùng **Wilson Score** để cân bằng.

### Wilson Score Interval (Lower Bound)

```
                    p̂ + z²/2n - z × √(p̂(1-p̂)/n + z²/4n²)
Wilson Lower = ─────────────────────────────────────────────────
                              1 + z²/n

Trong đó:
  p̂  = tỷ lệ positive ratings (VD: 4-5 sao / tổng reviews)
  n  = tổng số reviews
  z  = 1.96 (confidence 95%)
```

**Ví dụ:**

```
Khóa A: 2/2 positive → p̂ = 1.0, n = 2
  Wilson = (1.0 + 1.92 - 1.96×√(0/2 + 0.96)) / (1 + 1.92)
         ≈ 0.342

Khóa B: 450/500 positive → p̂ = 0.9, n = 500
  Wilson = (0.9 + 0.004 - 1.96×√(0.09/500 + 0.000008)) / (1.004)
         ≈ 0.873

→ Khóa B (0.873) > Khóa A (0.342) ✅ Công bằng hơn!
```

### Time Decay (Trending)

Khóa có nhiều enrollment gần đây → trending:

```
                         enrollments_last_7_days
Trending Score = ──────────────────────────────────── × decay_factor
                    avg_enrollments_per_week (30 ngày)

decay_factor = e^(-λ × days_since_publish)
λ = 0.01 (decay rate — khóa cũ vẫn có cơ hội nhưng thấp hơn)
```

### Combined Popularity Score

```
Popularity Score = 0.6 × Wilson Score + 0.4 × Trending Score
```

### Implementation (Pseudo-code)

```javascript
function popularityRecommend(topN = 10) {
  const courses = getAllPublishedCourses();

  const scores = courses.map((course) => {
    // Wilson Score
    const totalReviews = course.reviewCount;
    const positiveReviews = course.reviews.filter((r) => r.rating >= 4).length;
    const wilsonScore = wilsonLowerBound(positiveReviews, totalReviews);

    // Trending Score
    const recentEnrollments = getEnrollmentsLast7Days(course.id);
    const avgWeeklyEnrollments = getAvgWeeklyEnrollments(course.id, 30);
    const trendingRatio = avgWeeklyEnrollments > 0 ? recentEnrollments / avgWeeklyEnrollments : 0;
    const daysSincePublish = daysSince(course.publishedAt);
    const decay = Math.exp(-0.01 * daysSincePublish);
    const trendingScore = Math.min(trendingRatio * decay, 1); // cap at 1

    return {
      courseId: course.id,
      score: 0.6 * wilsonScore + 0.4 * trendingScore,
    };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, topN);
}

function wilsonLowerBound(positive, total) {
  if (total === 0) return 0;
  const z = 1.96;
  const phat = positive / total;
  const denominator = 1 + (z * z) / total;
  const numerator =
    phat +
    (z * z) / (2 * total) -
    z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);
  return numerator / denominator;
}
```

---

## 3.5 Hybrid: Trộn 3 thuật toán

### Weighted Hybrid

```javascript
function hybridRecommend(userId, topN = 10) {
  const userCourses = getUserEnrolledCourses(userId);

  // Chọn trọng số dựa trên lượng data của user
  let w1, w2, w3;

  if (userCourses.length === 0) {
    // NEW USER (cold-start) → chỉ dùng Popularity
    w1 = 0.0;
    w2 = 0.0;
    w3 = 1.0;
  } else if (userCourses.length <= 3) {
    // ÍT DATA → nghiêng Content-Based + Popularity
    w1 = 0.5;
    w2 = 0.1;
    w3 = 0.4;
  } else {
    // ĐỦ DATA → cân bằng cả 3
    w1 = 0.4;
    w2 = 0.4;
    w3 = 0.2;
  }

  // Lấy scores từ 3 thuật toán (đã normalize về 0-1)
  const cbScores = normalizeScores(contentBasedRecommend(userId, 50));
  const cfScores = normalizeScores(collaborativeRecommend(userId, 50));
  const popScores = normalizeScores(popularityRecommend(50));

  // Merge: với mỗi khóa chưa mua, tính weighted score
  const allCandidates = new Set([
    ...cbScores.map((s) => s.courseId),
    ...cfScores.map((s) => s.courseId),
    ...popScores.map((s) => s.courseId),
  ]);

  const finalScores = [...allCandidates].map((courseId) => {
    const cb = cbScores.find((s) => s.courseId === courseId)?.score || 0;
    const cf = cfScores.find((s) => s.courseId === courseId)?.score || 0;
    const pop = popScores.find((s) => s.courseId === courseId)?.score || 0;

    return {
      courseId,
      score: w1 * cb + w2 * cf + w3 * pop,
      breakdown: { contentBased: cb, collaborative: cf, popularity: pop },
    };
  });

  return finalScores.sort((a, b) => b.score - a.score).slice(0, topN);
}
```

### Chiến lược theo context hiển thị

```
┌──────────────────────────┬───────────────────────────────────────┐
│ Vị trí hiển thị          │ Thuật toán ưu tiên                   │
├──────────────────────────┼───────────────────────────────────────┤
│ Trang chủ (chưa login)   │ 100% Popularity + Trending           │
│ Trang chủ (đã login)     │ Hybrid (CB + CF + Pop)               │
│ Trang chi tiết khóa      │ "Khóa liên quan" → Content-Based     │
│ Sau khi mua khóa         │ "Người mua khóa này cũng mua" → CF  │
│ Sau khi hoàn thành khóa  │ "Học tiếp" → Content-Based + Level   │
│ Email weekly digest       │ Hybrid top 5                        │
└──────────────────────────┴───────────────────────────────────────┘
```

---

## 3.6 Smart Chapter Suggestion (Gợi ý chương cần mua)

### Ý tưởng

> "Bạn đã biết 70% nội dung khóa này → Chỉ cần mua 3 chương còn lại!"

### Thuật toán: Tag Overlap Analysis

```javascript
function suggestChapters(userId, courseId) {
  // 1. Lấy skills/tags user đã có (từ khóa đã học + quiz results)
  const userSkills = getUserSkillTags(userId);
  // VD: ["js-basics", "js-functions", "react-components", "react-hooks"]

  // 2. Lấy chapters của khóa + tags mỗi chapter
  const chapters = getCourseChapters(courseId);
  // VD: [
  //   { id: 1, name: "JS Fundamentals", tags: ["js-basics", "js-variables"], price: 50000 },
  //   { id: 2, name: "Functions & Scope", tags: ["js-functions", "js-scope"], price: 50000 },
  //   { id: 3, name: "Async/Await", tags: ["js-async", "js-promises"], price: 70000 },
  //   { id: 4, name: "React Hooks Deep Dive", tags: ["react-hooks", "react-state"], price: 80000 },
  // ]

  // 3. Tính overlap ratio cho mỗi chapter
  const suggestions = chapters.map((chapter) => {
    const chapterTags = new Set(chapter.tags);
    const overlap = [...chapterTags].filter((t) => userSkills.has(t)).length;
    const overlapRatio = overlap / chapterTags.size; // 0→1

    return {
      chapterId: chapter.id,
      chapterName: chapter.name,
      price: chapter.price,
      knowledgeOverlap: overlapRatio, // % user đã biết
      needToLearn: 1 - overlapRatio, // % cần học
      recommendation: overlapRatio >= 0.8 ? 'SKIP' : 'BUY',
    };
  });

  // 4. Kết quả
  const shouldBuy = suggestions.filter((s) => s.recommendation === 'BUY');
  const canSkip = suggestions.filter((s) => s.recommendation === 'SKIP');
  const bundlePrice = shouldBuy.reduce((sum, s) => sum + s.price, 0);
  const fullCoursePrice = getCoursePrice(courseId);

  return {
    suggestions,
    summary: {
      totalChapters: chapters.length,
      shouldBuy: shouldBuy.length,
      canSkip: canSkip.length,
      bundlePrice,
      fullCoursePrice,
      savings: fullCoursePrice - bundlePrice,
      recommendation:
        bundlePrice > fullCoursePrice * 0.7
          ? 'Nên mua cả khóa (tiết kiệm hơn!)'
          : `Chỉ cần mua ${shouldBuy.length} chương, tiết kiệm ${savings}đ`,
    },
  };
}
```

---

## 3.7 Caching & Performance

```
┌─────────────────────────────────────────────┐
│ Chiến lược Cache cho Recommendation         │
├─────────────────────────────────────────────┤
│                                             │
│ 1. Pre-compute hàng đêm (Cron Job):        │
│    - Course similarity matrix (CB)          │
│    - Course-Course Jaccard matrix (CF)      │
│    - Popularity scores                      │
│    → Lưu vào Redis/DB                       │
│                                             │
│ 2. User request → đọc pre-computed data     │
│    → tính hybrid score realtime (nhanh)     │
│                                             │
│ 3. Cache kết quả per user: 1 giờ TTL        │
│    → Invalidate khi user mua khóa mới      │
│                                             │
│ Response time target: < 200ms               │
└─────────────────────────────────────────────┘
```

## 3.8 Tóm tắt điểm hay cho đồ án

| Điểm                     | Giải thích cho giám khảo                                   |
| ------------------------ | ---------------------------------------------------------- |
| Cosine Similarity        | Thuật toán kinh điển trong Information Retrieval           |
| Jaccard Similarity       | Đo lường tương đồng tập hợp — trực quan, dễ chứng minh     |
| Wilson Score             | Reddit dùng thuật toán này để rank — công bằng hơn average |
| Hybrid + Adaptive Weight | Giải quyết cold-start bằng chuyển trọng số tự động         |
| Chapter Suggestion       | Tính năng sáng tạo — chưa có ở Udemy/Coursera              |
| Pre-compute + Cache      | Giải pháp performance thực tế, production-ready            |

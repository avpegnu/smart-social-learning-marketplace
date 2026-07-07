# 04 — Recommendations: 3 Algorithms, Wilson Score, và Context-Aware Serving

> Giải thích chi tiết RecommendationsModule — Content-Based (Cosine Similarity),
> Collaborative Filtering (Jaccard Similarity), Popularity (Wilson Score + Time Decay),
> Hybrid computation, context-aware serving, và mathematical foundations.

---

## 1. TỔNG QUAN ARCHITECTURE

### 1.1 Two-phase Design

```
Phase 1: COMPUTE (Cron job — nặng, chạy 1 lần/ngày)
  ├── Content-Based: tag vectors → cosine similarity
  ├── Collaborative: enrollment sets → Jaccard similarity
  └── Hybrid: weighted average → store in CourseSimilarity

Phase 2: SERVE (API request — nhẹ, chạy mỗi request)
  ├── Read pre-computed scores from CourseSimilarity
  ├── Context-aware: chọn algorithm phù hợp
  └── Fallback to Popularity nếu không đủ data
```

**Tại sao tách compute/serve?**
- Compute: O(N²) pairwise comparison — chậm (100 courses = 10,000 pairs)
- Serve: O(1) database lookup — nhanh (<50ms)
- Compute chạy cron 3 AM daily (Phase 5.11) → user không bao giờ chờ

### 1.2 Files đã tạo

```
src/modules/recommendations/
├── recommendations.module.ts
├── recommendations.service.ts             # Orchestration + serve
├── recommendations.service.spec.ts        # 7 tests
├── recommendations.controller.ts          # 1 endpoint (@Public)
├── algorithms/
│   ├── content-based.service.ts           # Cosine similarity
│   ├── content-based.service.spec.ts      # 7 tests
│   ├── collaborative.service.ts           # Jaccard similarity
│   ├── collaborative.service.spec.ts      # 4 tests
│   └── popularity.service.ts              # Wilson Score + Time Decay
│   └── popularity.service.spec.ts         # 4 tests
└── dto/
    └── query-recommendations.dto.ts
```

---

## 2. ALGORITHM 1: CONTENT-BASED — Cosine Similarity

### 2.1 Lý thuyết: Cosine Similarity

```
Cosine Similarity đo góc giữa 2 vectors trong không gian N chiều.

Formula:
              A · B           Σ(Ai × Bi)
  cos(θ) = ─────── = ──────────────────────
            |A|×|B|   √(Σ(Ai²)) × √(Σ(Bi²))

Range: [-1, 1]
  1.0  = vectors cùng hướng (giống nhau hoàn toàn)
  0.0  = vectors vuông góc (không liên quan)
  -1.0 = vectors ngược hướng (đối lập)

Cho binary vectors (0/1): range [0, 1]
```

### 2.2 Ví dụ minh họa chi tiết

```
Tags trong hệ thống: [React, Hooks, Next.js, Node.js, Express, MongoDB]
                       t0     t1     t2      t3      t4      t5

Course A "React Mastery":       tags = [React, Hooks, Next.js]
  Vector A = [1, 1, 1, 0, 0, 0]

Course B "Next.js Full Stack":  tags = [React, Next.js, Node.js]
  Vector B = [1, 0, 1, 1, 0, 0]

Course C "MERN Stack":          tags = [Node.js, Express, MongoDB]
  Vector C = [0, 0, 0, 1, 1, 1]

Tính cos(A, B):
  A · B = (1×1) + (1×0) + (1×1) + (0×1) + (0×0) + (0×0) = 2
  |A| = √(1² + 1² + 1² + 0² + 0² + 0²) = √3
  |B| = √(1² + 0² + 1² + 1² + 0² + 0²) = √3
  cos(A,B) = 2 / (√3 × √3) = 2/3 ≈ 0.667 ← Khá similar

Tính cos(A, C):
  A · C = (1×0) + (1×0) + (1×0) + (0×1) + (0×1) + (0×0) = 0
  cos(A,C) = 0 / (√3 × √3) = 0 ← Hoàn toàn không liên quan

Tính cos(B, C):
  B · C = (1×0) + (0×0) + (1×0) + (1×1) + (0×1) + (0×0) = 1
  cos(B,C) = 1 / (√3 × √3) = 1/3 ≈ 0.333 ← Hơi similar (share Node.js)
```

### 2.3 Implementation

```typescript
async computeSimilarity() {
  const courses = await this.prisma.course.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    include: { courseTags: { select: { tagId: true } } },
  });

  // 1. Build global tag vocabulary
  const allTagIds = [...new Set(courses.flatMap(c => c.courseTags.map(t => t.tagId)))];
  // allTagIds = ["tag-react", "tag-hooks", "tag-nextjs", "tag-nodejs", ...]

  // 2. Pairwise comparison (triangle — j starts from i+1)
  for (let i = 0; i < courses.length; i++) {
    const tagsA = new Set(courseA.courseTags.map(t => t.tagId));
    const vectorA = allTagIds.map(t => tagsA.has(t) ? 1 : 0);
    // vectorA = [1, 1, 1, 0, 0, 0]

    for (let j = i + 1; j < courses.length; j++) {
      const vectorB = allTagIds.map(t => tagsB.has(t) ? 1 : 0);

      const score = this.cosineSimilarity(vectorA, vectorB);
      if (score <= 0.1) continue;  // Skip noise

      // Save both directions (A→B and B→A)
      await upsert(courseA.id, courseB.id, score, 'CONTENT');
      await upsert(courseB.id, courseA.id, score, 'CONTENT');
    }
  }
}
```

**Tại sao `j = i + 1` (triangle)?**
```
Courses: A, B, C, D
Full matrix:        Triangle only:
  A-B A-C A-D        A-B A-C A-D
  B-A B-C B-D            B-C B-D
  C-A C-B C-D                C-D
  D-A D-B D-C

cos(A,B) = cos(B,A) → symmetric!
Full: N² = 16 comparisons
Triangle: N(N-1)/2 = 6 comparisons → save 62.5%
Then save both directions in DB
```

**Tại sao threshold 0.1?**
- Scores < 0.1 = gần như không liên quan
- Lưu hết → table phình to (100 courses = ~5000 rows có score > 0)
- Skip noise → smaller table, faster queries

---

## 3. ALGORITHM 2: COLLABORATIVE FILTERING — Jaccard Similarity

### 3.1 Lý thuyết: Jaccard Similarity

```
Jaccard đo overlap giữa 2 tập hợp.

Formula:
              |A ∩ B|     Số phần tử chung
  J(A,B) = ─────────── = ──────────────────
              |A ∪ B|     Tổng phần tử distinct

Range: [0, 1]
  1.0 = hai tập giống nhau hoàn toàn
  0.0 = không có phần tử chung
```

### 3.2 Ví dụ minh họa

```
Course A enrolled by: {User1, User2, User3, User4, User5}
Course B enrolled by: {User1, User3, User5, User6, User7}
Course C enrolled by: {User8, User9}

Jaccard(A, B):
  A ∩ B = {User1, User3, User5} → |A ∩ B| = 3
  A ∪ B = {User1, User2, User3, User4, User5, User6, User7} → |A ∪ B| = 7
  J(A,B) = 3/7 ≈ 0.429

  Ý nghĩa: "43% users mua cả 2 khóa" → "Người mua A cũng hay mua B"

Jaccard(A, C):
  A ∩ C = {} → |A ∩ C| = 0
  J(A,C) = 0/7 = 0

  Ý nghĩa: Không ai mua cả A và C → không liên quan

Jaccard(B, C):
  B ∩ C = {} → |B ∩ C| = 0
  J(B,C) = 0/7 = 0
```

### 3.3 Implementation

```typescript
async computeSimilarity() {
  const enrollments = await this.prisma.enrollment.findMany({
    select: { userId: true, courseId: true },
  });

  // Build enrollment sets: courseId → Set<userId>
  const courseUsers = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!courseUsers.has(e.courseId)) courseUsers.set(e.courseId, new Set());
    courseUsers.get(e.courseId)!.add(e.userId);
  }

  // Pairwise Jaccard
  const courseIds = [...courseUsers.keys()];
  for (let i = 0; i < courseIds.length; i++) {
    for (let j = i + 1; j < courseIds.length; j++) {
      const setA = courseUsers.get(courseIds[i]!)!;
      const setB = courseUsers.get(courseIds[j]!)!;

      // Count intersection efficiently
      let intersection = 0;
      for (const u of setA) {
        if (setB.has(u)) intersection++;  // Set.has = O(1)
      }

      const union = setA.size + setB.size - intersection;
      const score = union > 0 ? intersection / union : 0;

      if (score <= 0) continue;
      // Save both directions...
    }
  }
}
```

**Intersection computation:**
```
Naive: [...setA].filter(u => setB.has(u)).length
  → Creates new array (memory allocation)

Optimized: for loop + counter
  → No array allocation, O(|setA|) time, O(1) memory

Set.has() is O(1) → total intersection = O(min(|setA|, |setB|))
```

---

## 4. ALGORITHM 3: POPULARITY — Wilson Score + Time Decay

### 4.1 Lý thuyết: Wilson Score Lower Bound

```
Vấn đề: Xếp hạng sản phẩm theo rating

Naive approach (simple average):
  Course A: 5.0 stars (1 review)   → #1
  Course B: 4.8 stars (500 reviews) → #2
  → SAI! 1 review không đáng tin bằng 500 reviews

Wilson Score: confidence interval cho tỷ lệ thành công
  → "Với 95% confidence, true rating nằm trong [lower, upper]"
  → Dùng LOWER bound → conservative estimate
  → Nhiều reviews → interval hẹp → lower bound cao hơn
```

### 4.2 Formula

```
Wilson Score Lower Bound:

       p̂ + z²/(2n) - z × √( p̂(1-p̂)/n + z²/(4n²) )
  W = ─────────────────────────────────────────────────
                     1 + z²/n

Where:
  p̂ = observed success rate (normalized rating 0-1)
  n = number of reviews
  z = 1.96 (95% confidence z-score)
```

### 4.3 Ví dụ minh họa

```
Course A: avgRating=5.0, reviews=1
  p̂ = (5.0 - 1) / 4 = 1.0  (normalize 1-5 to 0-1)
  n = 1, z = 1.96

  denominator = 1 + 1.96²/1 = 4.842
  centre = 1.0 + 1.96²/2 = 2.921
  spread = 1.96 × √(1.0×0.0/1 + 1.96²/4) = 1.96 × 0.98 = 1.921

  W = (2.921 - 1.921) / 4.842 = 0.206  ← LOW confidence

Course B: avgRating=4.5, reviews=100
  p̂ = (4.5 - 1) / 4 = 0.875
  n = 100, z = 1.96

  denominator = 1 + 1.96²/100 = 1.038
  centre = 0.875 + 1.96²/200 = 0.894
  spread = 1.96 × √(0.875×0.125/100 + 1.96²/40000) = 0.065

  W = (0.894 - 0.065) / 1.038 = 0.798  ← HIGH confidence

Course B (0.798) > Course A (0.206) ← Đúng! 4.5★ với 100 reviews đáng tin hơn 5.0★ với 1 review
```

### 4.4 Time Decay

```
timeFactor = 1 / (1 + log10(1 + days/30))

Course mới (0 ngày):  timeFactor = 1 / (1 + log10(1)) = 1.0
Course 30 ngày:       timeFactor = 1 / (1 + log10(2)) ≈ 0.77
Course 90 ngày:       timeFactor = 1 / (1 + log10(4)) ≈ 0.62
Course 365 ngày:      timeFactor = 1 / (1 + log10(13.2)) ≈ 0.47
Course 1000 ngày:     timeFactor = 1 / (1 + log10(34.3)) ≈ 0.39

Logarithmic decay → giảm nhanh ban đầu, chậm dần về sau
  → Course mới được boost, course cũ vẫn giữ relevance nếu rating cao
```

### 4.5 Combined Score

```
finalScore = wilsonScore × 0.7 + timeFactor × 0.3

Ví dụ:
  Course B (4.5★, 100 reviews, 30 days old):
    wilson = 0.798, time = 0.77
    final = 0.798 × 0.7 + 0.77 × 0.3 = 0.559 + 0.231 = 0.790

  Course C (4.2★, 50 reviews, 7 days old):
    wilson = 0.712, time = 0.90
    final = 0.712 × 0.7 + 0.90 × 0.3 = 0.498 + 0.270 = 0.768

  Course B (0.790) > Course C (0.768)
    → B wins vì rating confidence vượt trội time advantage
```

---

## 5. HYBRID — Weighted Average

### 5.1 Computation

```typescript
private async computeHybrid() {
  const contentScores = await this.prisma.courseSimilarity.findMany({
    where: { algorithm: 'CONTENT' },
  });
  const collabScores = await this.prisma.courseSimilarity.findMany({
    where: { algorithm: 'COLLABORATIVE' },
  });

  // Build score maps
  const contentMap = new Map<string, number>();  // "courseA:courseB" → score
  const collabMap = new Map<string, number>();

  // All unique pairs
  const allKeys = new Set([...contentMap.keys(), ...collabMap.keys()]);

  for (const key of allKeys) {
    const cb = contentMap.get(key) ?? 0;   // Content-Based score (or 0)
    const cf = collabMap.get(key) ?? 0;    // Collaborative score (or 0)
    const hybridScore = cb * 0.5 + cf * 0.5;

    await upsert(courseId, similarCourseId, hybridScore, 'HYBRID');
  }
}
```

### 5.2 Ví dụ

```
Course pair (React → Next.js):
  Content-Based score:   0.667 (share tags: React, Next.js)
  Collaborative score:   0.429 (3 users enrolled in both)

  Hybrid = 0.667 × 0.5 + 0.429 × 0.5 = 0.548

Course pair (React → MERN):
  Content-Based score:   0.0 (no shared tags)
  Collaborative score:   0.2 (few users overlap)

  Hybrid = 0.0 × 0.5 + 0.2 × 0.5 = 0.1
```

---

## 6. CONTEXT-AWARE SERVING

### 6.1 5 Contexts

```typescript
switch (context) {
  case 'homepage':      → Hybrid (CB + CF combined)
  case 'course_detail': → Content-Based (similar topics)
  case 'post_purchase': → Collaborative ("also bought")
  case 'post_complete': → Content-Based (next course)
  default:              → Hybrid
}
```

### 6.2 Tại sao context-aware?

```
Scenario 1: Homepage (đã login)
  User đã mua React, Vue → recommend Next.js, Nuxt (hybrid)
  Algorithm: HYBRID — combine topic similarity + enrollment patterns

Scenario 2: Course detail page
  Đang xem "React Hooks" → recommend "React Advanced", "Redux"
  Algorithm: CONTENT — courses with similar tags

Scenario 3: After purchase
  Vừa mua "React" → "Người mua React cũng mua Next.js"
  Algorithm: COLLABORATIVE — enrollment overlap

Scenario 4: After completing course
  Hoàn thành "React Basics" → "Học tiếp React Advanced"
  Algorithm: CONTENT — similar but higher level

Scenario 5: Homepage (chưa login)
  Anonymous → Popular courses (Wilson Score)
  Algorithm: POPULARITY — no personalization possible
```

### 6.3 Fallback Chain

```
Request:
  1. Try specific algorithm for context
  2. If empty results → fallback to Popularity
  3. If no enrollments → fallback to Popularity

Example:
  User mới, 0 enrollments → getHybrid()
    → enrolledCourseIds = [] → return popularity
  User with enrollments but no HYBRID scores yet → getHybrid()
    → similarities = [] → return popularity
```

---

## 7. CONTROLLER — @Public() with Optional Auth

```typescript
@Public()
@Get()
async getRecommendations(
  @CurrentUser() user: JwtPayload | undefined,
  @Query() query: QueryRecommendationsDto,
) {
  return this.service.getRecommendations(user?.sub ?? null, query);
}
```

**`@Public()` + `@CurrentUser()` optional:**
- Anonymous: `user = undefined` → `userId = null` → popularity
- Authenticated: `user = { sub: "user-1" }` → personalized recommendations
- Same endpoint serves both — graceful degradation

---

## 8. TESTING ALGORITHMS

### 8.1 Cosine Similarity — Mathematical Verification

```typescript
it('should return value between 0 and 1 for partial overlap', () => {
  // Course A: [React, Hooks], Course B: [React, Next.js]
  // Tags: [React, Hooks, Next.js]
  // Vector A: [1, 1, 0], Vector B: [1, 0, 1]
  const result = service.cosineSimilarity([1, 1, 0], [1, 0, 1]);
  // cos = 1 / (√2 × √2) = 1/2 = 0.5
  expect(result).toBeCloseTo(0.5);
});

it('should be symmetric', () => {
  expect(service.cosineSimilarity(a, b))
    .toBeCloseTo(service.cosineSimilarity(b, a));
  // Cosine(A,B) = Cosine(B,A) — mathematical property
});
```

### 8.2 Wilson Score — Confidence vs Quantity

```typescript
it('should return higher score for more reviews at same rating', () => {
  const score1 = service.wilsonScoreLowerBound(4.5, 1);     // Low confidence
  const score100 = service.wilsonScoreLowerBound(4.5, 100);  // High confidence
  expect(score100).toBeGreaterThan(score1);
  // 4.5★ × 100 reviews → more trustworthy than 4.5★ × 1 review
});
```

### 8.3 Collaborative — Direction Verification

```typescript
it('should save both directions for each pair', async () => {
  mockPrisma.enrollment.findMany.mockResolvedValue([
    { userId: 'u1', courseId: 'cA' },
    { userId: 'u1', courseId: 'cB' },
  ]);

  await service.computeSimilarity();

  // Verify: cA→cB AND cB→cA
  expect(mockPrisma.courseSimilarity.upsert).toHaveBeenCalledTimes(2);
  // First call: cA → cB
  // Second call: cB → cA
});
```

---

## 9. DATABASE: CourseSimilarity Model

```prisma
model CourseSimilarity {
  courseId        String
  similarCourseId String
  score           Float               # 0.0 to 1.0
  algorithm       SimilarityAlgorithm # CONTENT | COLLABORATIVE | HYBRID

  @@unique([courseId, similarCourseId, algorithm])
  @@index([courseId, score(sort: Desc)])  # Fast lookup by course
}
```

**Composite unique key:**
- Same course pair can have 3 scores (1 per algorithm)
- `upsert` uses this key to update existing or create new

**Index on [courseId, score]:**
- Query: "top 10 similar courses for courseId=X" → index scan, no full table scan

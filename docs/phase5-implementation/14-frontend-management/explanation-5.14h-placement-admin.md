# Explanation 5.14h — Placement Questions Admin + Fixes

> Giải thích chi tiết các quyết định thiết kế và lý do kỹ thuật cho phase placement questions.

---

## 1. TẠI SAO CẦN BALANCED SELECTION (5/5/5)?

### Vấn đề

Trước đây, startTest() dùng Fisher-Yates shuffle toàn bộ questions rồi lấy 15 câu đầu. Nếu database có 20 BEGINNER, 5 INTERMEDIATE, 3 ADVANCED → sau shuffle có thể lấy 12 BEGINNER + 3 INTERMEDIATE + 0 ADVANCED.

Khi scoring, `determineLevel()` tính accuracy per level:
- BEGINNER: 10/12 = 83% → pass
- INTERMEDIATE: 2/3 = 66% → fail
- ADVANCED: 0/0 = 0% (division by zero guard returns 0)

→ Recommend BEGINNER mặc dù user có thể giỏi ADVANCED (không có câu nào để test).

### Giải pháp

```
Group by level → Shuffle each → Pick 5 per level → Fill leftover → Final shuffle
```

**Tại sao 5/5/5?** 15 câu / 3 level = 5. Đủ sample size để tính accuracy có ý nghĩa (70% = 3.5/5, tức đúng 4/5).

**Tại sao fill leftover?** Nếu category chỉ có 2 ADVANCED questions → pick 2 ADVANCED + fill 3 từ BEGINNER/INTERMEDIATE leftover. Vẫn tốt hơn random 15.

**Tại sao final shuffle?** Nếu không shuffle lại, câu hỏi sẽ luôn theo thứ tự BEGINNER → INTERMEDIATE → ADVANCED, dễ đoán pattern.

---

## 2. TẠI SAO UPSERT THAY VÌ CREATE?

### Vấn đề

Mỗi lần submit tạo 1 PlacementTest record mới. User làm 10 lần → 10 records. Không có business logic nào dùng history (không hiển thị lịch sử, không compare kết quả qua thời gian).

### Giải pháp

`@@unique([userId])` + `upsert({ where: { userId } })`:
- Lần đầu: create
- Lần sau: update (ghi đè scores + recommendedLevel)
- Luôn chỉ có 1 record per user

**Tại sao không giữ history?** Đây là placement test (đánh giá ban đầu), không phải exam system. Không cần track progress over time. Nếu sau này cần history, có thể thêm PlacementTestHistory table riêng.

---

## 3. TẠI SAO REQUIRE LOGIN TRƯỚC KHI START?

### Vấn đề ban đầu

Flow cũ: Start (public) → làm 15 câu → Submit → cần JWT → show modal login → user login → redirect về landing page → MẤT HẾT STATE (answers, questions).

### Giải pháp

Check auth ở `handleStart()`:
```typescript
if (!isAuthenticated) {
  router.push('/login?redirect=/placement-test');
  return;
}
```

**Tại sao không lưu state vào localStorage trước khi redirect?**
- Questions được shuffle random mỗi lần start → không thể resume
- Options order có thể khác → answers sẽ sai
- Phức tạp hóa flow cho edge case hiếm (user chưa login nhưng muốn test)
- Simple is better: login trước, test sau

---

## 4. TẠI SAO BATCH ENDPOINT RIÊNG?

### Vấn đề

Import from Text có thể parse 20-50 câu hỏi cùng lúc. Gọi `POST /admin/placement-questions` 50 lần = 50 HTTP requests + 50 DB queries.

### Giải pháp

`POST /admin/placement-questions/batch` — nhận array, dùng `$transaction` tạo tất cả trong 1 DB transaction:
- 1 HTTP request
- 1 transaction (atomic — tất cả thành công hoặc tất cả fail)
- Invalidate query 1 lần

**Tại sao không dùng `createMany`?** Prisma `createMany` không return created records. Dùng `$transaction` với array of `create` để vừa batch vừa get results.

---

## 5. TẠI SAO IMPORT FROM TEXT THAY VÌ IMPORT FROM BANK?

### Context

Ban đầu implement Import from Bank (giống quiz builder), nhưng:
- Admin không sở hữu question banks — banks thuộc về instructors
- Placement questions có thêm `level` và `tagIds` mà bank questions không có
- Phải thêm step 3 để assign level + tags → UX phức tạp

### Giải pháp

Import from Text — cùng format với quiz builder:
```
1. What is React?
a) A library *
b) A framework
```

**Ưu điểm:**
- Admin có thể prepare questions trong spreadsheet/document → paste vào
- Reuse `parseQuizText()` parser có sẵn
- Step 2 chỉ cần chọn 1 level + tags cho batch (simple)
- Không dependency vào instructor's question banks

---

## 6. PLACEMENT QUESTIONS ↔ TAGS RELATIONSHIP

### Tại sao dùng tagIds (String[]) thay vì relation table?

PlacementQuestion lưu `tagIds: String[]` thay vì many-to-many relation vì:
- Placement questions là flat, independent entities — không cần reverse lookup (tag → questions)
- Filter dùng `hasSome` operator — đủ performant cho dataset nhỏ (hundreds, not millions)
- Không cần cascade delete khi tag bị xóa (orphan tagIds vô hại)
- Simple schema, không thêm join table

### Category → Tags derivation

Khi student chọn category:
```
Category → courses → courseTags → tagIds → filter placement questions
```

Đây là indirect relationship — placement questions link tới tags, categories link tới tags qua courses. Không cần direct category → placement_questions relation.

---

## 7. ADMIN PAGE DESIGN DECISIONS

### DataTable vs Custom Grid

Chọn DataTable (có sẵn) với server-side pagination vì:
- Consistent với Tags, Users, Courses pages
- Built-in pagination, loading state
- Admin expects table layout cho CRUD data

### Portal Modals

Create/Edit form dùng `ReactDOM.createPortal(content, document.body)` thay vì Dialog component vì:
- Form phức tạp (dynamic options builder, tag chips) cần custom layout
- Avoid z-index issues với DataTable
- Pattern đã dùng ở quiz builder, question banks — consistency

### Tag Chip Toggle vs Multi-Select

Chọn chip toggle grid (click to toggle) thay vì multi-select dropdown vì:
- Visual: thấy được tất cả tags cùng lúc
- Tactile: click nhanh hơn dropdown → search → click
- Số lượng tags moderate (10-30) → grid display hợp lý
- Pattern đã dùng ở course wizard tag selector

---

## 8. SEED DATA STRATEGY

### Tại sao file seed riêng?

`seed-placement.ts` chạy độc lập thay vì thêm vào `seed.ts` vì:
- Không muốn re-run entire seed (có thể conflict với existing data)
- Idempotent: check `findFirst({ where: { question } })` → skip nếu đã tồn tại
- Có thể chạy lại an toàn: `npx ts-node -O '{"module":"CommonJS"}' src/prisma/seed-placement.ts`

### Tag slug → ID mapping at runtime

```typescript
const tagMap = new Map<string, string>();
for (const tag of tags) tagMap.set(tag.slug, tag.id);
```

Thay vì hardcode tag IDs vì:
- Tag IDs là CUID — khác nhau mỗi environment
- Slugs ổn định (`react`, `python`, `docker`)
- Tự động adapt khi deploy lên staging/production

---

## 9. TEST COVERAGE

### Placement Tests Service: 8 tests (was 4)

**Added:**
- Balanced 5/5/5 selection verification
- Leftover fill when level has < 5
- All questions returned when total < 15
- Category tag filtering verification
- Upsert verification (not create)

### Admin Content Service: +8 tests (total 33)

**Added:**
- getPlacementQuestions: pagination, search, level filter, sort
- CRUD: create, update (partial), delete
- Batch: $transaction verification

---

## 10. BREADCRUMB LOCALIZATION

### Vấn đề

`labelMap` trong breadcrumb component thiếu entries cho:
- `tags` → hiển thị raw "tags" thay vì "Tags"
- `placement-questions` → hiển thị raw "placement-questions"
- `question-banks` → hiển thị raw "question-banks"

### Fix

Thêm 3 entries vào `labelMap`:
```typescript
tags: t('tags'),
'placement-questions': t('placementQuestions'),
'question-banks': t('questionBanks'),
```

Tất cả keys đã tồn tại trong `nav` namespace — chỉ thiếu mapping trong breadcrumb component.

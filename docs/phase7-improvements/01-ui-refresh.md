# Phase 7.1 — UI Refresh: Modern Color System & Component Polish

> Tài liệu mô tả chi tiết đợt refresh UI cho cả 2 portal (student & management).
> Mục tiêu: làm UI hiện đại hơn, đa dạng màu sắc hơn, dễ chịu cho mắt ở cả light/dark mode mà không phá vỡ existing layout.

---

## Bối cảnh

Sau khi project đã deploy production và hoàn tất các phase 1-6, đợt audit UI cho thấy:

**Vấn đề:**
1. Color palette đơn điệu — chỉ có 1 màu primary blue, slate grays, không có variety
2. Stat cards trên dashboard tất cả icon đều cùng 1 màu primary
3. Light mode có background `#ffffff` (pure white) — gắt mắt
4. Shadows cơ bản (3 levels), không có depth perception
5. Hero section dùng gradient hardcoded `violet-500`, `blue-500` — không tương thích design system
6. Button không có hover lift effect
7. Skeleton loader chỉ pulse, không có shimmer
8. Bug: danh sách Q&A có cards "dính sát vào nhau" (no visible gap)

**Mục tiêu:**
- Giữ semantic tokens (không phá existing components)
- Chuyển sang OKLCH color space (modern, perceptually uniform)
- Mở rộng palette với multi-accent colors
- Refined elevation system (6 levels + glow)
- Polish components với hover effects, smoother focus states
- Background light mode dùng off-white thay vì pure white

---

## Tổng quan thay đổi

| Phase | Nội dung | Files | Risk |
|-------|----------|-------|------|
| 1 | Color system v2 (OKLCH + multi-accent) | 2 globals.css | Thấp — chỉ đổi values, semantic tokens giữ nguyên |
| 2 | Elevation, shadows, glow utilities | (cùng 2 files) | Thấp — additive |
| 3 | Component polish (shared-ui) | button, card, input, skeleton | Thấp — chỉ thêm hover effects |
| 4 | Page-specific improvements | homepage, my-learning, course-card, stat-card | Trung bình — sửa visual chứ không sửa logic |
| 5 | Bug fix: QnA list spacing | qna/page.tsx | Thấp — fix CSS layout bug |
| 6 | Soften light mode background | (cùng 2 globals.css) | Thấp |

---

## Phase 1: Color System v2 — OKLCH + Multi-Accent

### Lý do chọn OKLCH

OKLCH là color space hiện đại được khuyến nghị bởi Tailwind v4 và shadcn/ui:
- **Perceptually uniform** — thay đổi lightness L cho ra cùng mức cảm nhận, không bị "jumpy" như HSL
- **Wider gamut** — dùng được P3 colors trên màn hình hiện đại
- **Predictable** — dễ tạo palette consistent với cùng 1 hue

Format: `oklch(L C H)` — Lightness 0-1, Chroma 0-0.4, Hue 0-360.

### Files đã sửa

1. **[apps/student-portal/src/app/globals.css](apps/student-portal/src/app/globals.css)**
2. **[apps/management-portal/src/app/globals.css](apps/management-portal/src/app/globals.css)**

### Light mode palette (cả 2 portals)

```css
:root {
  /* Background: subtle off-white (không pure white để dễ chịu cho mắt) */
  --background: oklch(0.985 0.004 265);  /* student */
  --background: oklch(0.98 0.005 265);   /* management — slightly more tinted */

  /* Card: pure white để "lift" lên trên background */
  --card: oklch(1 0 0);

  --foreground: oklch(0.18 0.020 265);

  /* Primary: vibrant indigo (chuyển từ blue cũ #2563eb) */
  --primary: oklch(0.58 0.22 265);
  --primary-foreground: oklch(0.99 0.005 265);

  /* Multi-accent palette — màu phụ cho stats, badges, illustrations */
  --accent-violet: oklch(0.62 0.22 295);
  --accent-pink: oklch(0.66 0.22 350);
  --accent-cyan: oklch(0.70 0.14 200);
  --accent-emerald: oklch(0.65 0.17 165);
  --accent-amber: oklch(0.78 0.16 75);
  --accent-rose: oklch(0.65 0.20 15);
}
```

### Dark mode palette

```css
[data-theme='dark'] {
  /* Student: slightly elevated card surfaces */
  --background: oklch(0.14 0.014 265);
  --card: oklch(0.18 0.014 265);  /* lifted +0.04 */

  /* Management: deeper background (admin convention) */
  --background: oklch(0.10 0.014 265);
  --card: oklch(0.15 0.014 265);

  --primary: oklch(0.68 0.20 265);  /* brighter for visibility */
  /* ... multi-accent colors slightly brighter than light mode */
}
```

### Tại sao card lift được trên background

Khi background là `oklch(0.985)` và card là `oklch(1)`, card sáng hơn 1.5% — đủ để mắt phân biệt nhưng không gắt. Cộng với shadow-xs là perfect "lifted" effect.

### Backward compatibility

**Tất cả existing semantic tokens giữ nguyên tên** (`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`). Mọi component dùng `bg-primary`, `text-foreground`, etc. tự động lấy giá trị mới mà không cần sửa code.

---

## Phase 2: Elevation, Shadows & Glow

### 6-level shadow system (light mode)

Chuyển từ 3 levels (sm, md, lg) lên 6 levels, tinted với primary hue cho cohesion:

```css
@theme inline {
  --shadow-xs: 0 1px 2px 0 oklch(0.15 0.020 265 / 0.04);
  --shadow-sm: 0 1px 3px 0 oklch(0.15 0.020 265 / 0.06), 0 1px 2px -1px oklch(0.15 0.020 265 / 0.05);
  --shadow-md: 0 4px 6px -1px oklch(0.15 0.020 265 / 0.08), 0 2px 4px -2px oklch(0.15 0.020 265 / 0.05);
  --shadow-lg: 0 10px 15px -3px oklch(0.15 0.020 265 / 0.10), 0 4px 6px -4px oklch(0.15 0.020 265 / 0.06);
  --shadow-xl: 0 20px 25px -5px oklch(0.15 0.020 265 / 0.12), 0 8px 10px -6px oklch(0.15 0.020 265 / 0.08);
  --shadow-2xl: 0 25px 50px -12px oklch(0.15 0.020 265 / 0.20);

  /* Glow effects — dùng primary hue */
  --shadow-glow-sm: 0 0 12px oklch(0.58 0.22 265 / 0.18);
  --shadow-glow-md: 0 0 24px oklch(0.58 0.22 265 / 0.24);
  --shadow-glow-lg: 0 0 40px oklch(0.58 0.22 265 / 0.30);
}
```

### Dark mode shadows

Trong dark mode, shadow tinted với primary trông không đẹp (vì background đã tối). Override sang shadow đen thuần:

```css
[data-theme='dark'] {
  --shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.30);
  --shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.40), ...;
  /* ... etc */

  /* Glow: dùng primary hue brighter */
  --shadow-glow-sm: 0 0 12px oklch(0.68 0.20 265 / 0.30);
}
```

### New utility classes

```css
.text-gradient        /* gradient text với brand colors */
.bg-gradient-brand    /* gradient background brand */
.bg-mesh-1            /* mesh gradient cho hero sections */
.glow-sm/md/lg        /* glow shadows */
.hover-lift           /* hover lift effect (translate -2px + shadow-lg) */
.animate-gradient     /* gradient shift animation 8s loop */
```

---

## Phase 3: Component Polish (shared-ui)

### Button — [packages/shared-ui/src/components/button.tsx](packages/shared-ui/src/components/button.tsx)

**Trước:** Static, hover chỉ đổi opacity.

**Sau:**
- `hover:-translate-y-px` — nhô lên 1px khi hover
- `active:scale-[0.98]` — feedback khi click
- `hover:shadow-md` — shadow đậm hơn khi hover
- Thêm variant `gradient` — dùng `bg-gradient-brand` + `hover:shadow-glow-md`
- Outline variant: `hover:border-primary/40` thay vì chỉ đổi background

```tsx
default:
  'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-md hover:-translate-y-px',
gradient:
  'bg-gradient-brand text-primary-foreground shadow-sm hover:shadow-glow-md hover:-translate-y-px',
```

### Card — [packages/shared-ui/src/components/card.tsx](packages/shared-ui/src/components/card.tsx)

**Trước:** `border-border bg-card shadow-sm`

**Sau:** `border-border/60 bg-card shadow-xs`

- Border opacity 60% → mềm hơn, subtle hơn
- Default shadow xs → ít nổi hơn, để components tự control khi cần emphasize

### Input — [packages/shared-ui/src/components/input.tsx](packages/shared-ui/src/components/input.tsx)

**Trước:** Focus dùng `ring-2 ring-offset-2`

**Sau:**
- `ring-4 ring-ring/40` — wider, softer ring (giống Linear/Vercel style)
- `focus-visible:border-ring` — border đổi màu khi focus
- `hover:border-input/80` — hover state trước khi focus
- `transition-all duration-200`
- Placeholder mờ hơn `placeholder:text-muted-foreground/70`

### Skeleton — [packages/shared-ui/src/components/skeleton.tsx](packages/shared-ui/src/components/skeleton.tsx)

**Trước:** `bg-muted animate-pulse`

**Sau:** `shimmer-skeleton` — gradient shimmer animation thay vì pulse, mượt hơn nhiều.

---

## Phase 4: Page-Specific Improvements

### Student Portal — Homepage Hero

**File:** [apps/student-portal/src/app/[locale]/(main)/page.tsx](apps/student-portal/src/app/[locale]/(main)/page.tsx)

**Trước:**
```tsx
<section className="from-primary/10 via-background bg-gradient-to-br to-violet-500/10">
  <div className="bg-primary/10 absolute -top-40 -right-40 ..." />
  <div className="absolute -bottom-40 -left-40 ... bg-violet-500/10" />
  <h1>{t('heroTitle')}</h1>
</section>
```

**Sau:**
```tsx
<section className="bg-mesh-1">
  <div className="bg-primary/15 absolute -top-40 -right-40 h-96 w-96 ..." />
  <div className="bg-accent-violet/15 absolute -bottom-40 -left-40 h-96 w-96 ..." />
  <div className="bg-accent-pink/10 absolute top-1/2 left-1/2 h-72 w-72 ..." />
  <h1><span className="text-gradient">{t('heroTitle')}</span></h1>
</section>
```

Thay đổi:
- Background dùng `bg-mesh-1` utility (3 radial gradients tự động hoà 3 hue)
- Thêm 1 blob nữa ở giữa (3 blobs total) bằng `accent-pink`
- Title dùng `.text-gradient`
- Bỏ hardcoded `violet-500`, dùng `accent-violet` semantic token
- Stats numbers dùng `.text-gradient`

### Student Portal — My Learning Stat Cards

**File:** [apps/student-portal/src/app/[locale]/(main)/(protected)/my-learning/page.tsx](apps/student-portal/src/app/[locale]/(main)/(protected)/my-learning/page.tsx)

**Trước:** Tất cả 4 stat cards icon đều `text-primary bg-primary/10`.

**Sau:** Mỗi card 1 màu riêng:
- 📚 Courses in progress → `text-primary bg-primary/12`
- ✅ Completed → `text-accent-emerald bg-accent-emerald/12`
- 🔥 Streak → `text-accent-amber bg-accent-amber/15`
- 🏆 Certificates → `text-accent-violet bg-accent-violet/12`

Thêm hover effects:
- Card: `hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30`
- Icon: `group-hover:scale-110` — icon to lên khi hover card

### Student Portal — Course Card

**File:** [apps/student-portal/src/components/course/course-card.tsx](apps/student-portal/src/components/course/course-card.tsx)

**Trước:**
- `hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-1 hover:shadow-lg`
- Thumbnail: `group-hover:scale-105` (5% zoom)
- Placeholder: `from-primary/20 to-primary/5` (single hue gradient)
- Hover overlay: `group-hover:bg-black/10` (subtle dim)

**Sau:**
- `hover:shadow-glow-md hover:border-primary/40 hover:-translate-y-1` — primary glow effect
- Thumbnail: `group-hover:scale-110` (10% zoom, smoother)
- Placeholder: `from-primary/25 via-accent-violet/15 to-accent-pink/10` — tri-color gradient
- Hover overlay: `bg-linear-to-t from-black/40` — gradient overlay đẹp hơn

### Management Portal — Stat Card

**File:** [apps/management-portal/src/components/data-display/stat-card.tsx](apps/management-portal/src/components/data-display/stat-card.tsx)

Component này dùng ở 4 chỗ (instructor dashboard, revenue, course students, course detail).

**Trước:** Tất cả icon `bg-primary/10 text-primary`.

**Sau:** Map icon name → màu riêng:
```typescript
const iconColorMap: Record<string, string> = {
  DollarSign: 'bg-accent-emerald/12 text-accent-emerald',
  Users: 'bg-accent-cyan/12 text-accent-cyan',
  BookOpen: 'bg-primary/12 text-primary',
  Star: 'bg-accent-amber/15 text-accent-amber',
  Clock: 'bg-accent-violet/12 text-accent-violet',
};
```

Thêm:
- Card hover lift + shadow
- Icon `group-hover:scale-110`
- Icon container `rounded-xl` (thay vì `rounded-lg`)
- Text value: `tracking-tight` cho cleaner typography

---

## Phase 5: Bug Fix — QnA List Spacing

### Vấn đề

User report: "Sao mấy question dính vào nhau vậy?". Cards trong danh sách Q&A đứng sát nhau, không có khoảng cách.

### Root cause

```tsx
// Container có space-y-3 nhưng cards vẫn dính
<div className="space-y-3">
  {questions.map((q) => (
    <QuestionCard key={q.id} question={q} />
  ))}
</div>

// QuestionCard wrap Card trong Link
return (
  <Link href={`/qna/${question.id}`}>
    <Card>...</Card>
  </Link>
);
```

`<Link>` từ next-intl render thành `<a>` — **inline element**. Tailwind `space-y-*` translate thành `[& > * + *]:mt-X`, dùng `margin-top`. **Margin-top không hoạt động trên inline elements!**

### Fix

```tsx
// Đổi sang flex container — gap hoạt động trên mọi child type
<div className="flex flex-col gap-4">
  {questions.map((q) => (
    <QuestionCard key={q.id} question={q} />
  ))}
</div>
```

### Lessons learned

- `space-y-*` chỉ work với block-level children
- `flex flex-col gap-*` work universally (vì gap là flex/grid property)
- Default cho list mapping nên dùng `gap-*` thay vì `space-y-*`
- Trường hợp không bug: nếu Link/button có class `block`, `flex`, `grid`, `inline-block`, `flex w-full` thì margin-top vẫn work

### Audit kết quả

Đã scan toàn bộ student-portal và management-portal để tìm pattern tương tự. Chỉ có 1 case này là bug thật. Các case khác (như `qna/ask` Link với `block`, `notification-item` button với `flex w-full`) đều safe vì children đã có class block-level.

**File đã sửa:** [apps/student-portal/src/app/[locale]/(main)/qna/page.tsx](apps/student-portal/src/app/[locale]/(main)/qna/page.tsx)

---

## Phase 6: Soften Light Mode Background

### Vấn đề

User report: "Light mode hơi sáng quá (trắng tinh)".

Background `oklch(1 0 0)` = `#ffffff` pure white quá gắt mắt khi nhìn lâu, đặc biệt với các page có nhiều card trắng (dashboard, course list).

### Fix

Dùng off-white có tint xanh nhẹ cho background, giữ card pure white để vẫn lift được:

```css
:root {
  /* Student */
  --background: oklch(0.985 0.004 265);  /* off-white +xanh nhẹ */
  --card: oklch(1 0 0);                  /* pure white — vẫn lift được */

  /* Management — slightly more tinted vì admin nhìn lâu */
  --background: oklch(0.98 0.005 265);
  --card: oklch(1 0 0);
}
```

Tăng độ đậm secondary/muted/accent một chút để vẫn giữ visual hierarchy:
```css
--secondary: oklch(0.955 0.012 265);  /* trước: oklch(0.96 0.010 265) */
--muted: oklch(0.96 0.008 265);
--accent: oklch(0.955 0.012 265);
--border: oklch(0.91 0.010 265);
--input: oklch(0.91 0.010 265);
```

### Kết quả

- Background giờ giống màu Linear/Vercel (off-white có chút xanh)
- Cards trắng tinh "lift" lên trên background, tạo depth nhẹ nhưng rõ
- Không gắt mắt khi nhìn lâu
- Vẫn có cảm giác sạch sẽ, hiện đại

### Tại sao không dùng warm gray

Warm gray (hue ~80) trông giống Notion, nhưng:
- Không match với primary indigo (hue 265, cool tone)
- Tạo cảm giác disconnect giữa background và brand color

Dùng cool off-white (hue 265, cùng hue với primary nhưng C rất thấp 0.004) cho cohesion.

---

## Verification

Cả 2 portals đều build clean (`npx next build`):
- Student portal: ✅ build success
- Management portal: ✅ build success

TypeScript: ✅ 0 errors

Backward compatibility:
- ✅ Tất cả semantic tokens giữ nguyên tên
- ✅ Components cũ tự động lấy giá trị mới
- ✅ Không cần migrate code consumer
- ✅ Existing dark/light theme switch vẫn hoạt động

---

## Files Changed Summary

| Phase | File | Loại |
|-------|------|------|
| 1+2+6 | `apps/student-portal/src/app/globals.css` | Modified |
| 1+2+6 | `apps/management-portal/src/app/globals.css` | Modified |
| 3 | `packages/shared-ui/src/components/button.tsx` | Modified |
| 3 | `packages/shared-ui/src/components/card.tsx` | Modified |
| 3 | `packages/shared-ui/src/components/input.tsx` | Modified |
| 3 | `packages/shared-ui/src/components/skeleton.tsx` | Modified |
| 4 | `apps/student-portal/src/app/[locale]/(main)/page.tsx` | Modified |
| 4 | `apps/student-portal/src/app/[locale]/(main)/(protected)/my-learning/page.tsx` | Modified |
| 4 | `apps/student-portal/src/components/course/course-card.tsx` | Modified |
| 4 | `apps/management-portal/src/components/data-display/stat-card.tsx` | Modified |
| 5 | `apps/student-portal/src/app/[locale]/(main)/qna/page.tsx` | Modified |

**Total: 11 files modified, 0 files created/deleted, 0 breaking changes.**

---

## Commit Plan

1. `style(theme): refresh color system to oklch with multi-accent palette`
   - 2 globals.css files

2. `style(shared-ui): polish button card input skeleton with hover effects`
   - 4 shared-ui components

3. `style(student): polish homepage hero my-learning stats and course card`
   - 3 student portal files

4. `style(management): polish stat card with multi-accent icons`
   - 1 management portal file

5. `fix(student): use flex gap for qna list to fix inline link spacing`
   - 1 file

---

## Future Improvements (deferred)

Có thể làm tiếp trong các phase sau:

- **Display font cho headings** — vd Cal Sans, Geist Display thay cho Inter
- **More page polish** — dashboard pages, settings pages chưa được touch
- **Toast styling** — Sonner toasts có thể glassmorphism hơn
- **Empty state illustrations** — thêm illustrations thay vì chỉ icons
- **Page transitions** — View Transitions API cho smooth navigation
- **Form polish** — error states, loading states cho form fields
- **Tables** — refined hover, sorting indicators
- **Charts (Recharts)** — apply theme colors via CSS vars

# Phase 5.13 UI Polish — Visual Design, Animations & Mobile Responsive

> Sửa CSS/styling + mobile responsive. Không sửa business logic.

---

## Commits

1. `804e482` style(css,shared-ui): add animations, gradients, glass morphism and favicons
2. `5c26766` style(student): polish homepage hero, navbar glass, course cards, mobile sidebar
3. `ad99632` style(management): add mobile responsive, avatar dropdown, filter badges

---

## Files đã thay đổi (23 files)

### CSS & Shared UI (10 files)
| File | Thay đổi |
|------|----------|
| `apps/student-portal/src/app/globals.css` | +gradient vars, +fadeInUp/shimmer/marquee animations, +glass utility |
| `apps/management-portal/src/app/globals.css` | +fadeInUp/shimmer animations |
| `packages/shared-ui/src/components/card.tsx` | +`transition-all duration-300` |
| `packages/shared-ui/src/components/button.tsx` | `transition-colors` → `transition-all duration-200` |
| `packages/shared-ui/src/components/progress.tsx` | `bg-primary` → `bg-gradient-to-r from-primary to-primary/80` |
| `packages/shared-ui/src/components/sheet.tsx` | Revert z-index changes (kept original) |
| `apps/student-portal/public/favicon.svg` | NEW — "S" trắng trên gradient blue-violet |
| `apps/management-portal/public/favicon.svg` | NEW — "M" xanh trên dark slate |
| `apps/student-portal/src/app/layout.tsx` | +favicon metadata |
| `apps/management-portal/src/app/layout.tsx` | +favicon metadata |

### Student Portal (5 files)
| File | Thay đổi |
|------|----------|
| `apps/student-portal/src/app/[locale]/(main)/page.tsx` | Hero gradient blue→violet + blurred circles, gradient text stats, marquee categories, feature card colors, rounded-full CTA buttons |
| `apps/student-portal/src/components/course/course-card.tsx` | Hover lift (-translate-y-1), border glow, shadow tint |
| `apps/student-portal/src/components/navigation/navbar.tsx` | Glass morphism, mobile sidebar (native overlay thay Sheet), active tab highlight |
| `apps/student-portal/messages/vi.json` | +categories key |
| `apps/student-portal/messages/en.json` | +categories key |

### Management Portal (9 files)
| File | Thay đổi |
|------|----------|
| `apps/management-portal/src/components/navigation/header.tsx` | Avatar dropdown (settings, logout), mobile hamburger menu with native overlay |
| `apps/management-portal/src/app/[locale]/(auth)/layout.tsx` | Remove DesktopGuard, responsive padding |
| `apps/management-portal/src/app/[locale]/instructor/layout.tsx` | Remove DesktopGuard, sidebar hidden mobile, responsive margin |
| `apps/management-portal/src/app/[locale]/admin/layout.tsx` | Remove DesktopGuard, sidebar hidden mobile, responsive margin |
| `apps/management-portal/src/components/data-display/data-table.tsx` | overflow-x-auto table, flex-wrap search/filters/pagination |
| `apps/management-portal/src/app/[locale]/admin/users/page.tsx` | Filters flex-wrap, divider hidden mobile |
| `apps/management-portal/src/app/[locale]/admin/reports/page.tsx` | Filters flex-wrap, badges px-3 py-1, divider hidden mobile |
| `apps/management-portal/src/app/[locale]/admin/analytics/page.tsx` | Badges px-3 py-1, responsive grid (2→4 cols), charts stack mobile |
| `apps/management-portal/src/app/[locale]/instructor/qna/page.tsx` | Badges px-3 py-1 |

---

## Chi tiết thay đổi

### 1. Animations & CSS Utilities
- `fadeInUp`: opacity 0→1, translateY 16px→0 (0.5s ease-out)
- `shimmer`: gradient background-position shift (skeleton loading)
- `marquee`: translateX 0→-50% liên tục (category auto-scroll)
- `.glass`: backdrop-filter blur(12px) saturate(180%)
- Gradient CSS variables: `--gradient-start`, `--gradient-end` cho cả light/dark

### 2. Homepage Hero
- Gradient: `from-primary/10 via-background to-violet-500/10`
- 2 decorative blurred circles (primary + violet) tạo depth
- Badge: gradient background, `px-4 py-1.5 text-sm`
- Stats: gradient text `bg-clip-text text-transparent`
- CTA buttons: `h-12 rounded-full px-8 text-base`
- Feature icons: blue (Social), violet (AI), emerald (Quality)
- Feature cards: hover lift + shadow

### 3. Category Bar
- Layout: "Danh mục" label bên trái + marquee scroll bên phải
- Duplicate items cho infinite scroll loop
- `animate-marquee` pause on hover

### 4. Course Cards
- Hover: `-translate-y-1` lift effect
- Border: `hover:border-primary/30` glow
- Shadow: `hover:shadow-primary/5` tint

### 5. Navbar Glass Morphism
- `backdrop-blur-xl` (12px→24px blur)
- `border-border/50` (nhạt hơn)
- `bg-background/70` (slightly more transparent)

### 6. Mobile Sidebar (cả 2 portals)
- Thay Sheet component bằng native `useState` + `fixed inset-0 z-50` overlay
- Backdrop `bg-black/60`
- Active tab highlight: `bg-primary text-primary-foreground`
- Theme toggle + locale switcher ở bottom
- User info + logout button
- Click outside/X button để đóng

### 7. Management Header
- Avatar → DropdownMenu (name, email, settings link, logout)
- Mobile hamburger button (`md:hidden`)
- Theme/locale hidden on mobile (có trong sidebar)

### 8. Responsive Tables & Filters
- DataTable: `overflow-x-auto` trên border container
- Search + filters: `flex-wrap`
- Pagination: `flex-wrap gap-2`
- Filter badges: thống nhất `px-3 py-1 text-sm`
- Dividers: `hidden md:block`
- Analytics grid: `grid-cols-2 md:grid-cols-4`

### 9. DesktopGuard Removed
- Bỏ DesktopGuard từ auth, instructor, admin layouts
- Management portal accessible trên mobile
- Login page responsive (`px-4`)

### 10. Favicons
- Student: SVG "S" gradient blue→violet, rounded rect
- Management: SVG "M" blue text on dark slate
- Referenced via `metadata.icons` in root layouts

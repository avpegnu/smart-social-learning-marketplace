# 1. DESIGN SYSTEM — Smart Social Learning Marketplace

> Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + next-themes + next-intl

---

## 1.1 Tổng quan Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND ARCHITECTURE                           │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │    STUDENT PORTAL            │  │    MANAGEMENT PORTAL         │ │
│  │    (student.app.com)         │  │    (manage.app.com)          │ │
│  │                              │  │                              │ │
│  │  Next.js 16 App              │  │  Next.js 16 App              │ │
│  │  ├── app/[locale]/           │  │  ├── app/[locale]/           │ │
│  │  ├── components/             │  │  ├── components/             │ │
│  │  ├── hooks/                  │  │  ├── hooks/                  │ │
│  │  ├── stores/                 │  │  ├── stores/                 │ │
│  │  └── lib/                    │  │  └── lib/                    │ │
│  └──────────────┬───────────────┘  └──────────────┬───────────────┘ │
│                 │                                  │                 │
│  ┌──────────────▼──────────────────────────────────▼───────────────┐ │
│  │              SHARED PACKAGES (monorepo)                         │ │
│  │  @shared/ui          — shadcn/ui components + custom            │ │
│  │  @shared/api-client  — API client (fetch wrapper + types)       │ │
│  │  @shared/hooks       — Shared React hooks                       │ │
│  │  @shared/i18n        — Translation files + utilities            │ │
│  │  @shared/types       — Shared TypeScript types                  │ │
│  │  @shared/utils       — Utilities (format, validation, ...)      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│                     ┌────────────▼────────────┐                     │
│                     │   NestJS Backend API     │                     │
│                     │   (api.app.com)          │                     │
│                     └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure (Turborepo)

```
smart-social-learning/
├── apps/
│   ├── student-portal/              # Next.js 16 — Student
│   │   ├── app/
│   │   │   └── [locale]/            # i18n dynamic segment
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx         # Homepage
│   │   │       ├── (auth)/          # Auth group
│   │   │       ├── (main)/          # Main layout group
│   │   │       └── (learning)/      # Learning layout group
│   │   ├── components/              # Portal-specific components
│   │   ├── hooks/                   # Portal-specific hooks
│   │   ├── stores/                  # Zustand stores
│   │   └── next.config.ts
│   │
│   └── management-portal/           # Next.js 16 — Management
│       ├── app/
│       │   └── [locale]/
│       │       ├── layout.tsx
│       │       ├── (auth)/
│       │       ├── (instructor)/    # Instructor pages
│       │       └── (admin)/         # Admin pages
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       └── next.config.ts
│
├── packages/
│   ├── ui/                          # @shared/ui
│   │   ├── src/
│   │   │   ├── components/          # shadcn/ui + custom components
│   │   │   │   ├── ui/             # Base shadcn components
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   │   ├── toast.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── data-display/   # Tables, cards, lists
│   │   │   │   ├── feedback/       # Loading, skeleton, empty states
│   │   │   │   ├── navigation/     # Navbar, sidebar, breadcrumb
│   │   │   │   └── overlay/        # Modal, drawer, popover
│   │   │   ├── theme/
│   │   │   │   ├── tokens.css       # CSS custom properties
│   │   │   │   └── provider.tsx     # ThemeProvider (next-themes)
│   │   │   └── index.ts
│   │   ├── tailwind.config.ts       # Shared Tailwind config
│   │   └── package.json
│   │
│   ├── api-client/                  # @shared/api-client
│   │   ├── src/
│   │   │   ├── client.ts           # Fetch wrapper with interceptors
│   │   │   ├── auth.ts             # Auth API
│   │   │   ├── courses.ts          # Courses API
│   │   │   ├── users.ts            # Users API
│   │   │   └── ...                 # Per-module API files
│   │   └── package.json
│   │
│   ├── hooks/                       # @shared/hooks
│   │   ├── src/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-debounce.ts
│   │   │   ├── use-infinite-scroll.ts
│   │   │   ├── use-media-query.ts
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── i18n/                        # @shared/i18n
│   │   ├── messages/
│   │   │   ├── vi.json              # Vietnamese (default)
│   │   │   └── en.json              # English
│   │   ├── src/
│   │   │   ├── config.ts           # next-intl config
│   │   │   ├── request.ts          # Server-side i18n
│   │   │   └── navigation.ts       # Localized navigation
│   │   └── package.json
│   │
│   ├── types/                       # @shared/types
│   │   ├── src/
│   │   │   ├── api.ts              # API response types
│   │   │   ├── models.ts           # Entity types (User, Course, ...)
│   │   │   ├── enums.ts            # Shared enums
│   │   │   └── dto.ts              # Request/Response DTOs
│   │   └── package.json
│   │
│   └── utils/                       # @shared/utils
│       ├── src/
│       │   ├── format.ts           # formatPrice, formatDate, formatDuration
│       │   ├── validation.ts       # Zod schemas (shared with forms)
│       │   ├── url.ts              # URL builders
│       │   └── cn.ts               # clsx + twMerge
│       └── package.json
│
├── turbo.json                       # Turborepo config
└── package.json                     # Root package.json (npm workspaces)
```

---

## 1.2 Color System — Design Tokens

### Semantic Color Tokens (CSS Custom Properties)

```css
/* packages/ui/src/theme/tokens.css */

/* ============================================================
   LIGHT THEME (default)
   ============================================================ */
:root {
  /* === Brand Colors === */
  --color-primary: 222.2 47.4% 11.2%; /* Deep navy — main CTA */
  --color-primary-foreground: 210 40% 98%;
  --color-secondary: 210 40% 96.1%; /* Light blue-gray */
  --color-secondary-foreground: 222.2 47.4% 11.2%;
  --color-accent: 142.1 76.2% 36.3%; /* Green — success, learning progress */
  --color-accent-foreground: 355.7 100% 97.3%;

  /* === Semantic Colors === */
  --color-background: 0 0% 100%; /* White */
  --color-foreground: 222.2 84% 4.9%; /* Near-black text */
  --color-card: 0 0% 100%;
  --color-card-foreground: 222.2 84% 4.9%;
  --color-popover: 0 0% 100%;
  --color-popover-foreground: 222.2 84% 4.9%;
  --color-muted: 210 40% 96.1%;
  --color-muted-foreground: 215.4 16.3% 46.9%;
  --color-border: 214.3 31.8% 91.4%;
  --color-input: 214.3 31.8% 91.4%;
  --color-ring: 222.2 47.4% 11.2%;

  /* === Status Colors === */
  --color-success: 142.1 76.2% 36.3%; /* Green — completed, active */
  --color-success-foreground: 355.7 100% 97.3%;
  --color-warning: 38 92% 50%; /* Amber — pending, caution */
  --color-warning-foreground: 48 96% 89%;
  --color-destructive: 0 84.2% 60.2%; /* Red — error, delete */
  --color-destructive-foreground: 0 0% 98%;
  --color-info: 217.2 91.2% 59.8%; /* Blue — info, link */
  --color-info-foreground: 0 0% 100%;

  /* === Learning-specific === */
  --color-progress: 142.1 76.2% 36.3%; /* Progress bar */
  --color-streak: 38 92% 50%; /* Learning streak */
  --color-quiz-correct: 142.1 76.2% 36.3%;
  --color-quiz-incorrect: 0 84.2% 60.2%;

  /* === Social-specific === */
  --color-like: 0 84.2% 60.2%; /* Heart/like */
  --color-online: 142.1 76.2% 36.3%; /* Online status dot */
  --color-mention: 217.2 91.2% 59.8%; /* @mention highlight */

  /* === Shadows === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);

  /* === Border Radius === */
  --radius-sm: 0.375rem; /* 6px */
  --radius-md: 0.5rem; /* 8px — default */
  --radius-lg: 0.75rem; /* 12px — cards */
  --radius-xl: 1rem; /* 16px — modals */
  --radius-full: 9999px; /* pills, avatars */

  /* === Spacing Scale === */
  --spacing-page: 1.5rem; /* Page padding (mobile) */
  --spacing-section: 2rem; /* Between sections */
  --spacing-card: 1rem; /* Card padding */

  /* === Sidebar (Management Portal) === */
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 68px;
}

/* ============================================================
   DARK THEME
   ============================================================ */
[data-theme='dark'] {
  /* === Brand Colors === */
  --color-primary: 210 40% 98%;
  --color-primary-foreground: 222.2 47.4% 11.2%;
  --color-secondary: 217.2 32.6% 17.5%;
  --color-secondary-foreground: 210 40% 98%;
  --color-accent: 142.1 70.6% 45.3%;
  --color-accent-foreground: 144.9 80.4% 10%;

  /* === Semantic Colors === */
  --color-background: 222.2 84% 4.9%; /* Near-black */
  --color-foreground: 210 40% 98%; /* Near-white text */
  --color-card: 222.2 84% 4.9%;
  --color-card-foreground: 210 40% 98%;
  --color-popover: 222.2 84% 4.9%;
  --color-popover-foreground: 210 40% 98%;
  --color-muted: 217.2 32.6% 17.5%;
  --color-muted-foreground: 215 20.2% 65.1%;
  --color-border: 217.2 32.6% 17.5%;
  --color-input: 217.2 32.6% 17.5%;
  --color-ring: 212.7 26.8% 83.9%;

  /* === Status Colors (brighter in dark mode) === */
  --color-success: 142.1 70.6% 45.3%;
  --color-warning: 48 96% 53%;
  --color-destructive: 0 62.8% 50.6%;
  --color-info: 217.2 91.2% 59.8%;

  /* === Shadows (subtle in dark mode) === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4);
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3);
}

/* ============================================================
   RESPONSIVE SPACING OVERRIDE
   ============================================================ */
@media (min-width: 768px) {
  :root {
    --spacing-page: 2rem;
    --spacing-section: 3rem;
    --spacing-card: 1.5rem;
  }
}

@media (min-width: 1280px) {
  :root {
    --spacing-page: 3rem;
    --spacing-section: 4rem;
  }
}
```

---

## 1.3 Typography

```
Font Stack:
  - Headings: Inter (Google Fonts, variable weight 600-800)
  - Body: Inter (Google Fonts, variable weight 400-500)
  - Code: JetBrains Mono (Google Fonts)
  - Fallback: system-ui, -apple-system, sans-serif
```

### Type Scale (Tailwind)

| Token          | Size            | Weight | Line Height | Usage                        |
| -------------- | --------------- | ------ | ----------- | ---------------------------- |
| `text-display` | 36px / 2.25rem  | 800    | 1.1         | Hero headings                |
| `text-h1`      | 30px / 1.875rem | 700    | 1.2         | Page titles                  |
| `text-h2`      | 24px / 1.5rem   | 700    | 1.3         | Section headings             |
| `text-h3`      | 20px / 1.25rem  | 600    | 1.4         | Card titles                  |
| `text-h4`      | 18px / 1.125rem | 600    | 1.4         | Sub-sections                 |
| `text-body`    | 16px / 1rem     | 400    | 1.6         | Body text (default)          |
| `text-body-sm` | 14px / 0.875rem | 400    | 1.5         | Secondary text               |
| `text-caption` | 12px / 0.75rem  | 500    | 1.4         | Labels, metadata             |
| `text-code`    | 14px / 0.875rem | 400    | 1.6         | Code blocks (JetBrains Mono) |

### Tailwind Extension

```typescript
// packages/ui/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{ts,tsx}',
    '../../apps/*/app/**/*.{ts,tsx}',
    '../../apps/*/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '1.1', fontWeight: '800' }],
        h1: ['1.875rem', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['1.5rem', { lineHeight: '1.3', fontWeight: '700' }],
        h3: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      colors: {
        border: 'hsl(var(--color-border))',
        input: 'hsl(var(--color-input))',
        ring: 'hsl(var(--color-ring))',
        background: 'hsl(var(--color-background))',
        foreground: 'hsl(var(--color-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--color-secondary))',
          foreground: 'hsl(var(--color-secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--color-accent))',
          foreground: 'hsl(var(--color-accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--color-destructive))',
          foreground: 'hsl(var(--color-destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--color-success))',
          foreground: 'hsl(var(--color-success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
          foreground: 'hsl(var(--color-warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--color-info))',
          foreground: 'hsl(var(--color-info-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--color-muted))',
          foreground: 'hsl(var(--color-muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--color-card))',
          foreground: 'hsl(var(--color-card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--color-popover))',
          foreground: 'hsl(var(--color-popover-foreground))',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        card: 'var(--shadow-card)',
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        skeleton: 'skeleton-pulse 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-bottom': 'slide-in-bottom 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
};

export default config;
```

---

## 1.4 Responsive Breakpoints

```
┌─────────────┬────────────┬──────────────────────────────────┐
│ Breakpoint  │ Min Width  │ Target                           │
├─────────────┼────────────┼──────────────────────────────────┤
│ mobile      │ 0px        │ Phone (portrait)                 │
│ sm          │ 640px      │ Phone (landscape) / Small tablet │
│ md          │ 768px      │ Tablet (portrait)                │
│ lg          │ 1024px     │ Tablet (landscape) / Laptop      │
│ xl          │ 1280px     │ Desktop                          │
│ 2xl         │ 1536px     │ Large desktop                    │
└─────────────┴────────────┴──────────────────────────────────┘
```

### Responsive Strategy

```
Student Portal:
  mobile  → Single column, bottom nav, hamburger menu
  md      → 2-column grid, sidebar collapse
  lg      → Full layout, persistent sidebar for learning
  xl      → Max-width container (1280px), centered

Management Portal:
  mobile  → NOT responsive (minimum 1024px) — show "please use desktop" message
  lg      → Sidebar + content area
  xl      → Sidebar + wider content + optional detail panel

Course Player:
  mobile  → Video full-width, tabs below (curriculum/notes/Q&A)
  lg      → Video (70%) + sidebar curriculum (30%)
  xl      → Video (65%) + sidebar (25%) + notes panel (10%)
```

---

## 1.5 Theme System (Dark/Light Mode)

### Implementation: next-themes

```typescript
// packages/ui/src/theme/provider.tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"          // Use data-theme attribute
      defaultTheme="system"           // Follow system preference
      enableSystem={true}             // Enable system detection
      disableTransitionOnChange={false} // Smooth transitions
      storageKey="ssml-theme"         // localStorage key
    >
      {children}
    </NextThemesProvider>
  )
}
```

### Theme Toggle Component

```typescript
// packages/ui/src/components/ui/theme-toggle.tsx
'use client'

import { useTheme } from 'next-themes'
import { Button } from './button'
import { Sun, Moon, Monitor } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { useTranslations } from 'next-intl'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const t = useTranslations('common.theme')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{t('toggle')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> {t('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> {t('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" /> {t('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Dark Mode Design Rules

```
1. Background Hierarchy (Dark Mode):
   Level 0 (page):       hsl(222.2, 84%, 4.9%)    — deepest
   Level 1 (card):       hsl(217.2, 32.6%, 8%)     — raised
   Level 2 (popover):    hsl(217.2, 32.6%, 12%)    — floating
   Level 3 (dropdown):   hsl(217.2, 32.6%, 15%)    — overlay

2. Text Hierarchy (Dark Mode):
   Primary text:    hsl(210, 40%, 98%)     — near-white
   Secondary text:  hsl(215, 20.2%, 65.1%) — muted
   Disabled text:   hsl(215, 20%, 40%)     — very muted

3. Border & Dividers:
   Default border:  hsl(217.2, 32.6%, 17.5%)  — subtle
   Active border:   hsl(212.7, 26.8%, 30%)    — emphasized

4. Images & Media:
   — Không invert images
   — Avatar: thêm subtle border (1px border) trong dark mode
   — Video player: giữ nguyên
   — Charts: dùng color tokens → tự động switch

5. Code Blocks:
   Light: GitHub Light theme (light bg, dark text)
   Dark:  GitHub Dark theme (dark bg, light text)
```

---

## 1.6 Component Library (shadcn/ui + Custom)

### Base Components (shadcn/ui)

| Category       | Components                                                                   | Ghi chú                    |
| -------------- | ---------------------------------------------------------------------------- | -------------------------- |
| **Input**      | Button, Input, Textarea, Select, Checkbox, Radio, Switch, Slider, DatePicker | React Hook Form compatible |
| **Display**    | Badge, Avatar, Card, Table, Separator, Progress, Skeleton                    | Đều hỗ trợ dark mode       |
| **Feedback**   | Toast (Sonner), Alert, AlertDialog, Tooltip                                  | i18n messages              |
| **Navigation** | Tabs, Breadcrumb, Pagination, NavigationMenu                                 | Active state styling       |
| **Overlay**    | Dialog, Sheet (Drawer), Popover, DropdownMenu, Command (⌘K)                  | Keyboard accessible        |
| **Layout**     | ScrollArea, Collapsible, Accordion, AspectRatio, Resizable                   | Responsive                 |

### Custom Components (Domain-specific)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOM COMPONENTS                             │
│                                                                  │
│  Course Components:                                              │
│  ├── CourseCard          — Thumbnail, title, price, rating       │
│  ├── CourseGrid          — Responsive grid of CourseCards        │
│  ├── CourseListItem      — Horizontal card for list view         │
│  ├── CourseCurriculum    — Expandable section/chapter/lesson     │
│  ├── CoursePlayer        — Video player + sidebar layout         │
│  ├── CourseProgress      — Progress bar with percentage          │
│  ├── CourseRating        — Star display + distribution chart     │
│  ├── PriceDisplay        — Price with discount, formatted VNĐ   │
│  └── LevelBadge          — Beginner/Intermediate/Advanced        │
│                                                                  │
│  Learning Components:                                            │
│  ├── VideoPlayer         — Video.js wrapper + progress tracking  │
│  ├── TextLesson          — Rich text renderer + scroll tracking  │
│  ├── QuizPlayer          — Question display + answer + feedback  │
│  ├── LearningStreak      — Streak calendar (GitHub-style)        │
│  ├── SkillsMap           — Tag cloud + proficiency levels        │
│  └── CertificatePreview  — Certificate card with verify link     │
│                                                                  │
│  Social Components:                                              │
│  ├── PostCard            — Post with text/image/code + actions   │
│  ├── PostComposer        — Create post (text + image + code)     │
│  ├── CommentThread       — Nested comments                       │
│  ├── UserCard            — Avatar + name + follow button         │
│  ├── ChatBubble          — Message bubble (sent/received)        │
│  ├── ChatInput           — Message input + emoji + file attach   │
│  ├── OnlineIndicator     — Green dot for online status           │
│  ├── TypingIndicator     — "User is typing..." animation        │
│  └── NotificationItem    — Icon + message + time + read status   │
│                                                                  │
│  Ecommerce Components:                                           │
│  ├── CartItem            — Course thumbnail + price + remove     │
│  ├── CartSummary         — Subtotal + coupon + total             │
│  ├── CheckoutForm        — Order summary + QR payment            │
│  ├── QRPayment           — VietQR code + countdown timer         │
│  ├── OrderStatusBadge    — PENDING/COMPLETED/EXPIRED colored     │
│  └── WishlistButton      — Heart toggle                          │
│                                                                  │
│  AI Components:                                                  │
│  ├── AIChatWindow        — Chat interface for AI Tutor           │
│  ├── AIChatBubble        — AI response with markdown rendering   │
│  ├── AITypingIndicator   — "AI is thinking..." with dots         │
│  └── AIUsageCounter      — "3/10 questions remaining today"      │
│                                                                  │
│  Q&A Components:                                                 │
│  ├── QuestionCard        — Title + tags + votes + answer count   │
│  ├── AnswerCard          — Content + votes + best answer badge   │
│  ├── VoteButtons         — Up/Down vote with count               │
│  └── CodeBlock           — Syntax highlighted code               │
│                                                                  │
│  Management Components:                                          │
│  ├── DashboardCard       — Metric + chart + trend                │
│  ├── DataTable           — Sortable, filterable, paginated       │
│  ├── StatusBadge         — Status with appropriate colors        │
│  ├── FileUpload          — Drag & drop + progress bar            │
│  ├── RichTextEditor      — Tiptap editor with toolbar            │
│  ├── ChartWidget         — Recharts wrapper (revenue, users...)  │
│  └── ApprovalActions     — Approve/Reject buttons + reason modal │
│                                                                  │
│  Shared Components:                                              │
│  ├── ThemeToggle         — Light/Dark/System mode switch         │
│  ├── LocaleSwitcher      — Vietnamese/English language toggle    │
│  ├── SearchBar           — Global search with Command palette    │
│  ├── InfiniteScroll      — Intersection Observer wrapper         │
│  ├── EmptyState          — Illustration + message + CTA          │
│  ├── ErrorBoundary       — Fallback UI for React errors          │
│  ├── LoadingOverlay      — Full-page loading spinner             │
│  ├── ConfirmDialog       — "Are you sure?" dialog                │
│  ├── ImageWithFallback   — Image + placeholder on error          │
│  └── RichTextRenderer    — Render Tiptap JSON → HTML safely      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Design Principles

```
1. Compound Pattern: Dùng cho complex components
   <CourseCard>
     <CourseCard.Image src="..." />
     <CourseCard.Title>Next.js Course</CourseCard.Title>
     <CourseCard.Price amount={299000} />
     <CourseCard.Rating value={4.5} count={120} />
   </CourseCard>

2. Variant Pattern: Dùng cva (class-variance-authority)
   <Button variant="default" size="md" />
   <Button variant="destructive" size="sm" />
   <Badge variant="success">Active</Badge>
   <Badge variant="warning">Pending</Badge>

3. Composition: Ưu tiên composition > inheritance
   <Card>
     <CardHeader>
       <CardTitle />
       <CardDescription />
     </CardHeader>
     <CardContent />
     <CardFooter />
   </Card>

4. Accessibility (a11y):
   - Tất cả interactive elements có focus ring
   - Keyboard navigation (Tab, Enter, Escape)
   - ARIA labels cho icon-only buttons
   - Screen reader text cho decorative elements
   - Color contrast ratio ≥ 4.5:1 (WCAG AA)

5. i18n-ready:
   - Mọi text trong component → useTranslations()
   - Không hardcode string
   - RTL-ready spacing (logical properties: ms-, me-, ps-, pe-)
   - Number/date formatting theo locale
```

---

## 1.7 Icon System

```
Library: Lucide React (MIT, 1000+ icons, tree-shakeable)
Size convention:
  - Inline (text): 16px (h-4 w-4)
  - Button icon: 16px-20px (h-4 w-4 / h-5 w-5)
  - Feature icon: 24px (h-6 w-6)
  - Empty state: 48px (h-12 w-12)

Icon mapping (key features):
  Home        → Home
  Search      → Search
  Course      → BookOpen
  Video       → Play
  Learning    → GraduationCap
  Social      → Users
  Chat        → MessageCircle
  AI Tutor    → Bot / Sparkles
  Cart        → ShoppingCart
  Wishlist    → Heart
  Bookmark    → Bookmark
  Notification→ Bell
  Settings    → Settings
  Dashboard   → LayoutDashboard
  Upload      → Upload
  Analytics   → BarChart3
  Revenue     → DollarSign (→ thay bằng "₫" text cho VNĐ)
  Star/Rating → Star
  Like        → ThumbsUp / Heart
  Comment     → MessageSquare
  Share       → Share2
  Follow      → UserPlus
  Q&A         → HelpCircle
  Code        → Code
  Certificate → Award
  Streak      → Flame
```

---

## 1.8 Loading & Skeleton States

### Skeleton Components

```typescript
// Mỗi page/component có skeleton tương ứng

// CourseCard skeleton
function CourseCardSkeleton() {
  return (
    <div className="animate-skeleton">
      <Skeleton className="aspect-video w-full rounded-lg" />    {/* Thumbnail */}
      <Skeleton className="mt-3 h-5 w-3/4" />                   {/* Title */}
      <Skeleton className="mt-2 h-4 w-1/2" />                   {/* Instructor */}
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-4 w-16" />                        {/* Rating */}
        <Skeleton className="h-4 w-12" />                        {/* Count */}
      </div>
      <Skeleton className="mt-2 h-5 w-20" />                    {/* Price */}
    </div>
  )
}

// Loading states hierarchy:
// 1. Page-level:   next.js loading.tsx → full page skeleton
// 2. Section-level: Suspense boundary → section skeleton
// 3. Component-level: isLoading prop → inline skeleton
// 4. Action-level: Button loading state → spinner + disabled
```

### Loading Pattern

```
┌──────────────────────────────────────────────────────┐
│  Page Load Flow:                                      │
│                                                       │
│  1. Server renders shell (layout + loading.tsx)        │
│     → User sees skeleton immediately                  │
│                                                       │
│  2. Server Components fetch data                       │
│     → Streaming HTML replaces skeleton                 │
│                                                       │
│  3. Client Components hydrate                          │
│     → Interactive elements become clickable            │
│                                                       │
│  Navigation (client-side):                             │
│  1. Click link → Router pushes URL                     │
│  2. loading.tsx renders (skeleton)                     │
│  3. Data fetched (Server Component / TanStack Query)   │
│  4. Page replaces skeleton                             │
│                                                       │
│  Mutations (forms, actions):                           │
│  1. User clicks Submit → Button shows spinner          │
│  2. Server Action / API call                           │
│  3. Success → toast + redirect/refetch                 │
│  4. Error → toast + form stays                         │
└──────────────────────────────────────────────────────┘
```

---

## 1.9 Empty States

```
Mỗi list/collection có empty state riêng:

┌───────────────────────────┐
│                           │
│     ┌─────────────┐      │
│     │  Illustration│      │
│     │  (48px icon) │      │
│     └─────────────┘      │
│                           │
│   "Chưa có khóa học nào"  │
│   "Hãy khám phá và đăng  │
│    ký khóa học đầu tiên"  │
│                           │
│   [ Khám phá khóa học ]   │  ← CTA button
│                           │
└───────────────────────────┘

Empty states cho từng section:
  - My Courses:     "Bạn chưa đăng ký khóa học nào" + CTA Browse
  - Cart:           "Giỏ hàng trống" + CTA Browse
  - Wishlist:       "Chưa có khóa học yêu thích"
  - Notifications:  "Không có thông báo mới"
  - Chat:           "Bắt đầu cuộc trò chuyện đầu tiên"
  - Feed:           "Chưa có bài viết nào" + "Hãy follow ai đó"
  - Search results: "Không tìm thấy kết quả cho 'xyz'"
  - Q&A:            "Chưa có câu hỏi nào" + CTA Ask
  - Orders:         "Bạn chưa có đơn hàng nào"
```

---

## 1.10 Form Patterns

### Tech Stack: React Hook Form + Zod

```typescript
// Pattern: mỗi form dùng Zod schema + React Hook Form

// 1. Define Zod schema (shared validation)
import { z } from 'zod'
import { useTranslations } from 'next-intl'

// Schema factory pattern for i18n validation messages
function createRegisterSchema(t: (key: string) => string) {
  return z.object({
    email: z.string()
      .min(1, t('validation.required'))
      .email(t('validation.email')),
    password: z.string()
      .min(8, t('validation.password.min'))
      .regex(/[A-Z]/, t('validation.password.uppercase'))
      .regex(/\d/, t('validation.password.number')),
    fullName: z.string()
      .min(2, t('validation.fullName.min'))
      .max(100, t('validation.fullName.max')),
  })
}

// 2. Use in component
function RegisterForm() {
  const t = useTranslations('auth.register')

  const schema = createRegisterSchema(t)
  type FormData = z.infer<typeof schema>

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', fullName: '' },
  })

  async function onSubmit(data: FormData) {
    const result = await registerAction(data)
    if (result.error) {
      // Map backend error to form field
      form.setError('email', { message: result.error })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField name="email" label={t('email')} />
        <FormField name="password" label={t('password')} type="password" />
        <FormField name="fullName" label={t('fullName')} />
        <Button type="submit" loading={form.formState.isSubmitting}>
          {t('submit')}
        </Button>
      </form>
    </Form>
  )
}

// 3. Form UX patterns:
//    - Validation: on-blur (first touch) → on-change (after first error)
//    - Error display: inline below field, red border + text
//    - Submit: disabled while submitting, spinner in button
//    - Success: toast notification + redirect
//    - Server error: toast + keep form state
```

---

## 1.11 Toast & Notification Patterns

```typescript
// Using Sonner (shadcn/ui toast)

// Success toast (green accent)
toast.success(t('toast.courseAdded'));

// Error toast (red)
toast.error(t('toast.paymentFailed'));

// Info toast (blue)
toast.info(t('toast.newNotification'));

// Loading toast (with promise)
toast.promise(enrollCourse(courseId), {
  loading: t('toast.enrolling'),
  success: t('toast.enrolled'),
  error: t('toast.enrollFailed'),
});

// Position: top-right (desktop), top-center (mobile)
// Duration: 4 seconds (default), 6 seconds (error)
// Max visible: 3 toasts stacked
```

---

## 1.12 Responsive Layouts

### Student Portal — Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop (≥1024px)                                            │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Navbar: Logo | Search | Browse | My Learning | Cart | 🔔 │ │
│ │         | Avatar ▾ | 🌙/☀️ | 🌐 VI/EN                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │                    Page Content                           │ │
│ │                    (max-w-7xl mx-auto)                    │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Footer: About | Contact | Terms | Privacy | Social Links │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│ Mobile (<768px)          │
│                          │
│ ┌──────────────────────┐ │
│ │ ☰  Logo      🔔 🛒  │ │  ← Compact navbar
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │    Page Content       │ │  ← Full-width, no padding-x
│ │    (single column)    │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 🏠  📚  🔍  💬  👤  │ │  ← Bottom navigation bar
│ │Home Learn Search      │ │
│ │          Chat Profile │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### Management Portal — Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Desktop (≥1024px)                                            │
│                                                              │
│ ┌────────┬─────────────────────────────────────────────────┐ │
│ │        │ Header: Breadcrumb | Search | 🔔 | 🌙 | 🌐 | 👤│ │
│ │        ├─────────────────────────────────────────────────┤ │
│ │  Side  │                                                 │ │
│ │  bar   │              Page Content                        │ │
│ │        │              (max-w-6xl)                          │ │
│ │ 260px  │                                                 │ │
│ │        │                                                 │ │
│ │  Logo  │                                                 │ │
│ │  ────  │                                                 │ │
│ │  Nav   │                                                 │ │
│ │  items │                                                 │ │
│ │  ────  │                                                 │ │
│ │  User  │                                                 │ │
│ │  menu  │                                                 │ │
│ └────────┴─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Sidebar Navigation (Instructor):
  📊 Dashboard
  📚 Courses
  💰 Revenue
  🎫 Coupons
  ❓ Q&A
  ⚙️ Settings

Sidebar Navigation (Admin):
  📊 Dashboard
  👥 Users
  ✅ Approvals
     ├── Instructor Applications
     └── Course Reviews
  📚 Courses
  🏷️ Categories
  💰 Withdrawals
  🚨 Reports
  📈 Analytics
  ⚙️ Settings
```

---

## 1.13 Animation & Transitions

```
Framework: Tailwind CSS transitions + Framer Motion (selective)

1. Micro-interactions (Tailwind only — no extra JS):
   - Button hover: scale(1.02) + bg change      → transition-all duration-150
   - Card hover: shadow-md → shadow-lg + translateY(-2px) → transition-all duration-200
   - Link hover: color change                    → transition-colors duration-150
   - Focus ring: ring-2 ring-primary             → transition-all duration-150
   - Toggle: bg slide                            → transition-all duration-200

2. Page Transitions (React View Transitions API — Next.js 16):
   - Page navigate: fade 200ms
   - Tab switch: slide horizontal 200ms

3. Complex Animations (Framer Motion — chỉ khi cần):
   - Modal open/close: scale + fade
   - Sidebar collapse/expand: width + content fade
   - Toast enter/exit: slide-in-right + fade
   - Accordion open/close: height auto-animate
   - Drag & drop (curriculum editor): layout animation

4. Loading animations:
   - Skeleton pulse: opacity 0.5 ↔ 1.0, 2s ease-in-out
   - Spinner: rotate 360°, 0.75s linear infinite
   - Progress bar: width transition 300ms ease
   - Typing indicator: 3 dots bounce

5. Performance rules:
   - Chỉ animate: transform, opacity (GPU-accelerated)
   - Không animate: width, height, top, left (trigger layout)
   - prefers-reduced-motion: tắt hết animation
     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after {
         animation-duration: 0.01ms !important;
         transition-duration: 0.01ms !important;
       }
     }
```

---

## 1.14 Accessibility (a11y)

```
Target: WCAG 2.1 Level A (cơ bản)

1. Keyboard Navigation:
   - Tab order logic (skip to main content)
   - Enter/Space for buttons & links
   - Escape to close modals/dropdowns
   - Arrow keys for menus, tabs, select
   - Focus trap trong modals

2. ARIA Labels:
   - Icon buttons: aria-label="Close dialog"
   - Loading states: aria-busy="true"
   - Live regions: aria-live="polite" cho toast/notifications
   - Form errors: aria-describedby linking to error message
   - Progress: role="progressbar" aria-valuenow={75}

3. Color Contrast:
   - Text: ≥ 4.5:1 contrast ratio (AA)
   - Large text (≥18px bold): ≥ 3:1
   - UI components: ≥ 3:1
   - Không chỉ dùng color để convey information (thêm icon/text)

4. Screen Reader:
   - Semantic HTML: <main>, <nav>, <article>, <aside>, <header>, <footer>
   - Heading hierarchy: h1 → h2 → h3 (không skip)
   - Image alt text (decorative → alt="")
   - sr-only class cho visual-only content

5. Focus Indicators:
   - Visible focus ring (2px) cho tất cả interactive elements
   - Focus-visible (chỉ hiện khi keyboard nav, không mouse click)
```

# Phase 4: Frontend Design — Smart Social Learning Marketplace

## Thống kê

| Metric                      | Value                                  |
| --------------------------- | -------------------------------------- |
| **Framework**               | Next.js 16 (App Router) + TypeScript   |
| **UI Library**              | shadcn/ui + Tailwind CSS 4             |
| **Portals**                 | 2 (Student Portal + Management Portal) |
| **Student Portal Pages**    | ~25 pages                              |
| **Management Portal Pages** | ~20 pages (Instructor: 10, Admin: 10)  |
| **Shared Components**       | ~50 custom + shadcn/ui base            |
| **Locales**                 | 2 (vi - default, en)                   |
| **Translation Keys**        | ~500+ keys per locale                  |
| **API Error Codes**         | ~50 error codes mapped                 |
| **Theme Modes**             | 3 (Light, Dark, System)                |
| **Zustand Stores**          | 3 (Auth, Cart, UI)                     |
| **WebSocket Namespaces**    | 2 (chat, notifications)                |
| **Monorepo Packages**       | 6 shared packages                      |

## Tài liệu

| #   | File                                                       | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [01-design-system.md](01-design-system.md)                 | Monorepo structure, color tokens (light/dark), typography, responsive breakpoints, theme system (next-themes), component library (shadcn/ui + ~50 custom), icons (Lucide), loading/skeleton states, empty states, form patterns (React Hook Form + Zod), toast system, animations, accessibility (WCAG 2.1 A)                                                                                                                                                                          |
| 2   | [02-i18n-and-messages.md](02-i18n-and-messages.md)         | next-intl setup, locale detection, full translation files (vi.json + en.json), backend API error code mapping (~50 codes), success message mapping, locale switcher component, number/date/price formatting, i18n checklist                                                                                                                                                                                                                                                            |
| 3   | [03-student-portal.md](03-student-portal.md)               | ~25 pages chi tiết: Homepage, Auth (login/register/verify/reset), Browse courses, Course detail (4 conditional states), Course player (video/text/quiz), Learning dashboard, News feed, Chat (WebSocket), Q&A forum, AI Tutor (SSE streaming), Cart, Checkout, Payment (QR + polling), Profile, Settings, Notifications, Become instructor, Orders, Wishlist, Certificates. Mỗi page: route, auth, rendering strategy, ASCII layout wireframe, components, data fetching, interactions |
| 4   | [04-management-portal.md](04-management-portal.md)         | ~20 pages: Instructor (Dashboard, Courses CRUD, Course wizard 4-step, Curriculum editor drag&drop, Revenue, Withdrawals, Coupons, Q&A, Settings) + Admin (Dashboard, Users, Instructor approvals, Course reviews, Categories, Withdrawals, Reports, Analytics, Platform settings). Portal access control, sidebar navigation, desktop-only strategy                                                                                                                                    |
| 5   | [05-state-and-integration.md](05-state-and-integration.md) | Data flow architecture, API client (server + client fetch, auto-refresh), TanStack Query (query keys, custom hooks, infinite query), Zustand stores (Auth, Cart, UI), Authentication flow (JWT + refresh + cross-portal OTT), WebSocket integration (chat + notifications), Video progress tracking, SSE streaming (AI Tutor), Optimistic updates pattern, Provider stack, Caching strategy, Error handling, Performance optimizations                                                 |

## Key Design Decisions

- **Next.js 16:** Turbopack default (2-5x faster build), React Compiler stable (auto memoize), `"use cache"` directive, View Transitions
- **Monorepo (Turborepo):** 2 apps + 6 shared packages → code reuse giữa 2 portals
- **shadcn/ui:** Copy-paste components, full control, Tailwind-based, dark mode ready
- **Dark/Light Mode:** next-themes + CSS custom properties, `data-theme` attribute, system preference detection
- **i18n:** next-intl (vi default + en), `[locale]` dynamic segment, backend error codes → frontend mapping
- **State:** Server Components for static data, TanStack Query for client cache, Zustand for global UI state
- **Auth:** JWT access token (memory) + refresh token (httpOnly cookie), auto-refresh on 401
- **Real-time:** Socket.io-client, 2 namespaces (chat + notifications), reconnection strategy
- **Forms:** React Hook Form + Zod validation + i18n error messages
- **Management Portal:** Desktop-only (min 1024px), sidebar layout, role-based routing guard
- **Performance:** Dynamic imports cho heavy components, ISR cho SEO pages, streaming cho progressive loading

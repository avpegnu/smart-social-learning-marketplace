// Helper dùng chung giữa Server Component (SSR seed) và Client Component (filter/sort).
// Giữ 1 nguồn logic build query params → params server tạo và params client tạo ở
// lần render đầu tiên GIỐNG NHAU, nên initialData seed đúng queryKey (không fetch lại).

import type { CourseFilters } from '@/components/course/course-filters';

export const PAGE_SIZE = 12;

export interface CourseListSearchParams {
  search?: string;
  category?: string;
  level?: string;
  price?: string;
  sort?: string;
  page?: string;
}

// searchParams (URL, dạng string) → state filters của client.
export function parseCourseFilters(sp: CourseListSearchParams): CourseFilters {
  return {
    search: sp.search ?? '',
    category: sp.category ?? '',
    level: sp.level ?? '',
    price: sp.price ?? 'all',
    sort: sp.sort ?? 'popular',
    page: Number(sp.page ?? '1') || 1,
  };
}

// filters → query params gửi lên API (khớp logic cũ của trang danh sách).
// `search` truyền vào là giá trị hiệu lực (client dùng debouncedSearch).
export function buildCourseApiParams(filters: CourseFilters): Record<string, string> {
  const p: Record<string, string> = {
    page: String(filters.page),
    limit: String(PAGE_SIZE),
  };
  if (filters.search) p.search = filters.search;
  if (filters.category) p.categorySlug = filters.category;
  if (filters.level) p.level = filters.level;
  if (filters.sort) p.sort = filters.sort;
  if (filters.price === 'free') p.maxPrice = '0';
  if (filters.price === 'paid') p.minPrice = '1';
  return p;
}

// So khớp 2 bộ params (shallow) để quyết định có seed initialData cho query hiện tại không.
export function courseParamsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Search, SlidersHorizontal, X, BookOpen } from 'lucide-react';
import {
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Select,
} from '@shared/ui';
import type { ApiResponse } from '@shared/api-client';
import { CourseGrid } from '@/components/course/course-grid';
import { CourseFilterSidebar, DEFAULT_FILTERS } from '@/components/course/course-filters';
import { Pagination } from '@/components/course/pagination';
import { EmptyState } from '@/components/feedback/empty-state';
import { useCourses, useCategories, useDebounce } from '@shared/hooks';
import type { CourseFilters } from '@/components/course/course-filters';
import { PAGE_SIZE, buildCourseApiParams, courseParamsEqual } from './params';

const SORT_OPTIONS = ['popular', 'newest', 'highest_rated', 'price_asc', 'price_desc'] as const;

interface CoursesClientProps {
  // Trạng thái ban đầu suy ra từ searchParams ở server → seed state, tránh dùng
  // useSearchParams (sẽ buộc bọc Suspense và làm trắng nội dung khi prerender).
  initialFilters: CourseFilters;
  // params + data fetch sẵn ở server cho lần render đầu → seed vào TanStack (SEO).
  initialParams: Record<string, string>;
  initialData?: ApiResponse<unknown>;
}

export function CoursesClient({ initialFilters, initialParams, initialData }: CoursesClientProps) {
  const t = useTranslations('courses');
  const router = useRouter();

  const [filters, setFilters] = useState<CourseFilters>(initialFilters);

  const debouncedSearch = useDebounce(filters.search, 300);

  const apiParams = useMemo(
    () => buildCourseApiParams({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );

  // Chỉ seed initialData khi params hiện tại trùng params server đã fetch; đổi
  // filter → params khác → không seed để query fetch dữ liệu đúng bộ lọc.
  const seedData = courseParamsEqual(apiParams, initialParams) ? initialData : undefined;

  const { data, isLoading } = useCourses(apiParams, seedData);
  const { data: categoriesData } = useCategories();

  const courses = (data?.data as Record<string, unknown>[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;
  const categories =
    (categoriesData?.data as Array<{ id: string; name: string; slug: string }>) ?? [];

  // Sync filters → URL. Use the debounced search value (not the raw keystroke
  // value) so typing does not trigger an RSC navigation request per character;
  // the URL now updates in lockstep with the debounced API query.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filters.category) params.set('category', filters.category);
    if (filters.level) params.set('level', filters.level);
    if (filters.price && filters.price !== 'all') params.set('price', filters.price);
    if (filters.sort !== 'popular') params.set('sort', filters.sort);
    if (filters.page > 1) params.set('page', String(filters.page));
    const qs = params.toString();
    router.replace(qs ? `/courses?${qs}` : '/courses', { scroll: false });
  }, [
    debouncedSearch,
    filters.category,
    filters.level,
    filters.price,
    filters.sort,
    filters.page,
    router,
  ]);

  const handleFilterChange = useCallback((key: keyof CourseFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? prev.page : 1 }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, search: prev.search, sort: prev.sort }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeFilterCount = [
    filters.category !== '',
    filters.level !== '',
    filters.price !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search bar */}
      <div className="relative mb-8">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-12 rounded-xl pl-12 text-base"
        />
        {filters.search && (
          <button
            onClick={() => handleFilterChange('search', '')}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-8">
        {/* Filter Sidebar - Desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="h-4 w-4" />
                {t('filters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CourseFilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                onClear={handleClearFilters}
                categories={categories}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t('showing')} <span className="text-foreground font-medium">{meta?.total ?? 0}</span>{' '}
              {t('results')}
            </p>

            <div className="flex items-center gap-3">
              {/* Mobile filter */}
              <Sheet>
                <SheetTrigger className="border-input bg-background hover:bg-accent hover:text-accent-foreground hidden gap-2 rounded-md border px-3 py-1.5 text-sm max-lg:inline-flex lg:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  {t('filters')}
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>{t('filters')}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <CourseFilterSidebar
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      onClear={handleClearFilters}
                      categories={categories}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground hidden text-sm sm:inline">
                  {t('sortBy')}
                </span>
                <Select
                  value={filters.sort}
                  onChange={(e) => handleFilterChange('sort', e.target.value)}
                  className="h-9 w-48"
                  options={SORT_OPTIONS.map((option) => ({
                    value: option,
                    label: t(`sort_${option}`),
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Course Grid */}
          {!isLoading && courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('noResults')}
              description={t('noResultsDesc')}
              actionLabel={activeFilterCount > 0 ? t('clearFilters') : undefined}
              onAction={activeFilterCount > 0 ? handleClearFilters : undefined}
            />
          ) : (
            <CourseGrid
              courses={courses as never[]}
              isLoading={isLoading}
              skeletonCount={PAGE_SIZE}
              columns={3}
            />
          )}

          {/* Pagination */}
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

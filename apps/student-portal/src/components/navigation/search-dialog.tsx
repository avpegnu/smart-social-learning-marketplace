'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, TrendingUp, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Skeleton } from '@shared/ui';
import { useCourses, useDebounce } from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import type { CourseCardCourse } from '@/components/course/course-card';

interface SearchDialogProps {
  onClose: () => void;
}

export function SearchDialog({ onClose }: SearchDialogProps) {
  const t = useTranslations('searchDialog');
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const hasQuery = debouncedQuery.trim().length > 0;
  const params: Record<string, string> = hasQuery
    ? { search: debouncedQuery, limit: '6' }
    : { sort: 'popular', limit: '4' };
  const { data, isLoading } = useCourses(params);
  const courses = (data as { data?: CourseCardCourse[] } | undefined)?.data ?? [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-[10vh] max-w-2xl px-4">
        <div className="bg-background border-border overflow-hidden rounded-xl border shadow-2xl">
          {/* Search input row */}
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="text-muted-foreground h-5 w-5 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
              }}
              placeholder={t('placeholder')}
              className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent py-4 text-base outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[55vh] overflow-y-auto">
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <TrendingUp className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {hasQuery ? t('searchResults') : t('popularCourses')}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <Skeleton className="h-10 w-14 shrink-0 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-16 shrink-0" />
                  </div>
                ))}
              </div>
            ) : courses.length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                {t('noResults')}
              </p>
            ) : (
              <ul className="p-2">
                {courses.map((course) => (
                  <li key={course.id}>
                    <Link
                      href={`/courses/${course.slug}`}
                      onClick={onClose}
                      className="hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                    >
                      <div className="bg-muted h-10 w-14 shrink-0 overflow-hidden rounded-md">
                        {course.thumbnailUrl && (
                          <img
                            src={course.thumbnailUrl}
                            alt={course.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{course.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {course.instructor?.fullName ?? course.instructor?.name}
                        </p>
                      </div>
                      <span className="text-primary shrink-0 text-sm font-semibold">
                        {course.price === 0 ? t('free') : formatPrice(course.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t px-4 py-2.5">
            <p className="text-muted-foreground text-xs">{t('pressEsc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

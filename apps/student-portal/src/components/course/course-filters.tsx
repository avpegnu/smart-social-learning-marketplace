'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button, Separator } from '@shared/ui';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const PRICE_OPTIONS = ['all', 'free', 'paid'] as const;

export interface CourseFilters {
  search: string;
  category: string;
  level: string;
  price: string;
  sort: string;
  page: number;
}

export const DEFAULT_FILTERS: CourseFilters = {
  search: '',
  category: '',
  level: '',
  price: 'all',
  sort: 'popular',
  page: 1,
};

interface CourseFilterSidebarProps {
  filters: CourseFilters;
  onFilterChange: (key: keyof CourseFilters, value: string) => void;
  onClear: () => void;
  categories: Array<{ id: string; name: string; slug: string }>;
}

export function CourseFilterSidebar({
  filters,
  onFilterChange,
  onClear,
  categories,
}: CourseFilterSidebarProps) {
  const t = useTranslations('courses');

  const hasActiveFilters =
    filters.category !== '' || filters.level !== '' || filters.price !== 'all';

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('category')}</h3>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="category"
              checked={filters.category === ''}
              onChange={() => onFilterChange('category', '')}
              className="border-input"
            />
            <span className="text-sm">{t('allCategories')}</span>
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="category"
                checked={filters.category === cat.slug}
                onChange={() => onFilterChange('category', cat.slug)}
                className="border-input"
              />
              <span className="text-sm">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Level */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('level')}</h3>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="level"
              checked={filters.level === ''}
              onChange={() => onFilterChange('level', '')}
              className="border-input"
            />
            <span className="text-sm">{t('allLevels')}</span>
          </label>
          {LEVELS.map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="level"
                checked={filters.level === level}
                onChange={() => onFilterChange('level', level)}
                className="border-input"
              />
              <span className="text-sm">{t(level.toLowerCase())}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('price')}</h3>
        <div className="space-y-2">
          {PRICE_OPTIONS.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="price"
                checked={filters.price === option}
                onChange={() => onFilterChange('price', option)}
                className="border-input"
              />
              <span className="text-sm">{t(`price_${option}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear button */}
      {hasActiveFilters && (
        <>
          <Separator />
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            {t('clearFilters')}
          </Button>
        </>
      )}
    </div>
  );
}

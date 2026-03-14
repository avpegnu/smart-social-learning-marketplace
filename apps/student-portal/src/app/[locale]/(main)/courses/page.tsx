'use client';

import { useTranslations } from 'next-intl';
import { Search, SlidersHorizontal } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@shared/ui';
import { CourseGrid } from '@/components/course/course-grid';
import { mockCourses, categories } from '@/lib/mock-data';
import { useState } from 'react';

const levels = ['beginner', 'intermediate', 'advanced'] as const;
const priceOptions = ['all', 'free', 'paid'] as const;
const ratingOptions = [4.5, 4.0, 3.5, 3.0] as const;
const sortOptions = ['popular', 'newest', 'rating', 'priceAsc', 'priceDesc'] as const;

function FilterSidebar({ t }: { t: (key: string) => string }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedPrice, setSelectedPrice] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('category')}</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="border-input rounded"
              />
              <span className="flex-1 text-sm">{cat.name}</span>
              <span className="text-muted-foreground text-xs">{cat.count}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Level */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('level')}</h3>
        <div className="space-y-2">
          {levels.map((level) => (
            <label key={level} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLevels.includes(level)}
                onChange={() => toggleLevel(level)}
                className="border-input rounded"
              />
              <span className="text-sm">{t(level)}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('price')}</h3>
        <div className="space-y-2">
          {priceOptions.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="price"
                checked={selectedPrice === option}
                onChange={() => setSelectedPrice(option)}
                className="border-input"
              />
              <span className="text-sm">{t(`price_${option}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Rating */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('rating')}</h3>
        <div className="space-y-2">
          {ratingOptions.map((rating) => (
            <label key={rating} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="rating"
                checked={selectedRating === rating}
                onChange={() => setSelectedRating(rating)}
                className="border-input"
              />
              <span className="text-sm">
                {rating}+ {t('stars')}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const t = useTranslations('courses');
  const [sortBy, setSortBy] = useState<string>('popular');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search bar */}
      <div className="relative mb-8">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input placeholder={t('searchPlaceholder')} className="h-12 rounded-xl pl-12 text-base" />
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
              <FilterSidebar t={t} />
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t('showing')}{' '}
              <span className="text-foreground font-medium">{mockCourses.length}</span>{' '}
              {t('results')}
            </p>

            <div className="flex items-center gap-3">
              {/* Mobile filter button */}
              <Sheet>
                <SheetTrigger className="lg:hidden">
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t('filters')}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>{t('filters')}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <FilterSidebar t={t} />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground hidden text-sm sm:inline">
                  {t('sortBy')}
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border-input bg-background h-9 cursor-pointer rounded-lg border px-3 text-sm"
                >
                  {sortOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(`sort_${option}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Course Grid */}
          <CourseGrid courses={mockCourses} columns={3} />

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled>
              {t('previous')}
            </Button>
            {[1, 2, 3].map((page) => (
              <Button
                key={page}
                variant={page === 1 ? 'default' : 'outline'}
                size="sm"
                className="w-9"
              >
                {page}
              </Button>
            ))}
            <Button variant="outline" size="sm">
              {t('next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

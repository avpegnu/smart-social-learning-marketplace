'use client';

import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { CourseGrid } from '@/components/course/course-grid';
import { EmptyState } from '@/components/feedback/empty-state';
import { mockCourses } from '@/lib/mock-data';
import { useState } from 'react';

export default function WishlistPage() {
  const t = useTranslations('wishlist');
  const [wishlistCourses, _setWishlistCourses] = useState(mockCourses.slice(0, 4));

  if (wishlistCourses.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState icon={Heart} title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {t('title')} ({wishlistCourses.length})
        </h1>
      </div>

      <CourseGrid courses={wishlistCourses} columns={4} />
    </div>
  );
}

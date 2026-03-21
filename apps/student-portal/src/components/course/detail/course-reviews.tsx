'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { Button, Card, CardContent, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { useCourseReviews } from '@shared/hooks';
import { cn } from '@/lib/utils';
import type { ApiReview } from './types';

interface CourseReviewsProps {
  courseId: string;
  avgRating: number;
  reviewCount: number;
  embeddedReviews: ApiReview[];
}

export function CourseReviews({
  courseId,
  avgRating,
  reviewCount,
  embeddedReviews,
}: CourseReviewsProps) {
  const t = useTranslations('courseDetail');
  const [reviewPage, setReviewPage] = useState(1);

  const { data: reviewsData } = useCourseReviews(courseId, {
    page: String(reviewPage),
    limit: '10',
    sort: 'newest',
  });

  const paginatedReviews = (reviewsData?.data as ApiReview[]) ?? [];
  const reviewMeta = reviewsData?.meta as
    | { page: number; totalPages: number; total: number }
    | undefined;

  const reviews = paginatedReviews.length > 0 ? paginatedReviews : embeddedReviews;

  return (
    <div>
      {/* Rating summary */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
              <div className="mt-1 flex items-center justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-4 w-4',
                      star <= Math.floor(avgRating) ? 'fill-warning text-warning' : 'text-muted',
                    )}
                  />
                ))}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {reviewCount} {t('ratings')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          <Star className="text-muted-foreground/50 mx-auto mb-3 h-12 w-12" />
          <p className="font-medium">{t('noReviews')}</p>
          <p className="mt-1 text-sm">{t('noReviewsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    {review.user.avatarUrl && (
                      <AvatarImage src={review.user.avatarUrl} alt={review.user.fullName} />
                    )}
                    <AvatarFallback>{review.user.fullName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium">{review.user.fullName}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(review.createdAt)}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'h-3.5 w-3.5',
                            star <= review.rating ? 'fill-warning text-warning' : 'text-muted',
                          )}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-muted-foreground text-sm">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {reviewMeta && reviewMeta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={reviewPage <= 1}
            onClick={() => setReviewPage((p) => p - 1)}
          >
            {t('previousReviews')}
          </Button>
          <span className="text-muted-foreground text-sm">
            {reviewPage} / {reviewMeta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={reviewPage >= reviewMeta.totalPages}
            onClick={() => setReviewPage((p) => p + 1)}
          >
            {t('nextReviews')}
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { formatRelativeTime } from '@shared/utils';
import {
  useCourseReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  useEnrollmentCheck,
  useAuthStore,
} from '@shared/hooks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiReview } from './types';

// ── Star Rating Input ──

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-7 w-7 cursor-pointer transition-colors',
            (hover || value) >= star
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground hover:text-yellow-300',
          )}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        />
      ))}
    </div>
  );
}

// ── Write Review Form ──

function WriteReviewForm({
  courseId,
  existingReview,
  onCancel,
}: {
  courseId: string;
  existingReview?: ApiReview | null;
  onCancel?: () => void;
}) {
  const t = useTranslations('courseDetail');
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const isEditing = !!existingReview;

  const createReview = useCreateReview(courseId);
  const updateReview = useUpdateReview(courseId);
  const isPending = createReview.isPending || updateReview.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error(t('ratingRequired'));
      return;
    }
    const data = { rating, comment: comment.trim() || undefined };
    if (isEditing && existingReview) {
      updateReview.mutate(
        { reviewId: existingReview.id, data },
        {
          onSuccess: () => {
            toast.success(t('reviewUpdated'));
            onCancel?.();
          },
        },
      );
    } else {
      createReview.mutate(data, {
        onSuccess: () => {
          toast.success(t('reviewSubmitted'));
          setRating(0);
          setComment('');
        },
      });
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h3 className="mb-4 text-lg font-semibold">
          {isEditing ? t('editReview') : t('writeReview')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-2 block text-sm">{t('yourRating')}</label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="text-muted-foreground mb-2 block text-sm">{t('yourComment')}</label>
            <textarea
              className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('commentPlaceholder')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || rating === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t('updateReview') : t('submitReview')}
            </Button>
            {isEditing && onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

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
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: enrollmentRaw } = useEnrollmentCheck(courseId);
  const enrollment = (enrollmentRaw as { data?: { enrolled?: boolean } })?.data;
  const deleteReview = useDeleteReview(courseId);

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

  const isEnrolled = !!enrollment?.enrolled;
  const myReview = reviews.find((r) => r.user.id === user?.id);
  const canWriteReview = isAuthenticated && isEnrolled && !myReview;

  const [deleteDialogReviewId, setDeleteDialogReviewId] = useState<string | null>(null);

  const handleDeleteConfirm = () => {
    if (!deleteDialogReviewId) return;
    deleteReview.mutate(deleteDialogReviewId, {
      onSuccess: () => {
        toast.success(t('reviewDeleted'));
        setDeleteDialogReviewId(null);
      },
    });
  };

  return (
    <div>
      {/* Write review form */}
      {canWriteReview && <WriteReviewForm courseId={courseId} />}

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
          {reviews.map((review) => {
            const isOwn = review.user.id === user?.id;
            const isEditing = editingReviewId === review.id;

            if (isEditing) {
              return (
                <WriteReviewForm
                  key={review.id}
                  courseId={courseId}
                  existingReview={review}
                  onCancel={() => setEditingReviewId(null)}
                />
              );
            }

            return (
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
                        <a
                          href={`/profile/${review.user.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {review.user.fullName}
                        </a>
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(review.createdAt)}
                        </span>
                        {isOwn && (
                          <div className="ml-auto flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingReviewId(review.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive h-7 w-7"
                              onClick={() => setDeleteDialogReviewId(review.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
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
            );
          })}
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

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteDialogReviewId}
        onOpenChange={(open) => !open && setDeleteDialogReviewId(null)}
        title={t('deleteReview')}
        description={t('deleteReviewConfirm')}
        confirmLabel={t('deleteReview')}
        variant="destructive"
        isLoading={deleteReview.isPending}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

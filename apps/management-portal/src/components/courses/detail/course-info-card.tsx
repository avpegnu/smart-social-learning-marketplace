'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@shared/ui';
import { formatPrice } from '@shared/utils';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_REVIEW: 'outline',
  PUBLISHED: 'default',
  REJECTED: 'destructive',
};

interface CourseInfoCardProps {
  course: Record<string, unknown>;
  category?: Record<string, unknown>;
}

export function CourseInfoCard({ course, category }: CourseInfoCardProps) {
  const t = useTranslations('courseDetail');
  const tc = useTranslations('common');
  const status = course.status as string;

  return (
    <div className="border-border space-y-4 rounded-lg border p-6">
      <h2 className="text-lg font-semibold">{t('basicInfo')}</h2>

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <InfoItem label={t('category')} value={(category?.name as string) ?? '—'} />
        <InfoItem
          label={t('level')}
          value={course.level ? tc(`courseLevel.${course.level}`) : '—'}
        />
        <InfoItem
          label={t('language')}
          value={
            (course.language as string) === 'vi'
              ? 'Tiếng Việt'
              : (course.language as string) === 'en'
                ? 'English'
                : ((course.language as string) ?? '—')
          }
        />
        <InfoItem label={t('price')} value="">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {(course.price as number) === 0
                ? t('free')
                : formatPrice((course.price as number) ?? 0)}
            </span>
            {(course.originalPrice as number) > 0 &&
              (course.originalPrice as number) > (course.price as number) && (
                <>
                  <span className="text-muted-foreground text-xs line-through">
                    {formatPrice(course.originalPrice as number)}
                  </span>
                  <span className="text-success text-xs font-semibold">
                    -
                    {Math.round(
                      (((course.originalPrice as number) - (course.price as number)) /
                        (course.originalPrice as number)) *
                        100,
                    )}
                    %
                  </span>
                </>
              )}
          </div>
        </InfoItem>
        <InfoItem label={t('status')} value="">
          <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'} className="px-3 py-1 text-sm">
            {tc(`courseStatus.${status}`)}
          </Badge>
        </InfoItem>
      </div>

      {(course.thumbnailUrl as string) && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">{t('thumbnail')}</p>
          <img
            src={course.thumbnailUrl as string}
            alt="Thumbnail"
            className="h-40 w-auto rounded-lg object-cover"
          />
        </div>
      )}

      {(course.description as string) && (
        <div>
          <p className="text-muted-foreground mb-2 text-sm">{t('description')}</p>
          <div
            className="prose prose-sm dark:prose-invert prose-p:text-foreground prose-li:text-foreground prose-headings:text-foreground border-border max-w-none overflow-hidden rounded-md border p-4 break-all"
            dangerouslySetInnerHTML={{ __html: course.description as string }}
          />
        </div>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      {children ?? <p className="font-medium">{value}</p>}
    </div>
  );
}

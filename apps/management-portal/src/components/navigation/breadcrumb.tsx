'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminCourseDetail, useInstructorCourseDetail } from '@shared/hooks';

// CUID pattern: starts with c + 25 alphanumeric chars
function isCuid(segment: string): boolean {
  return /^c[a-z0-9]{24,}$/i.test(segment);
}

export function Breadcrumb() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const allSegments = pathname.split('/').filter(Boolean);
  const skipSegments = new Set(['instructor', 'admin']);
  const segments = allSegments.filter((s) => !skipSegments.has(s));

  const labelMap: Record<string, string> = {
    dashboard: t('dashboard'),
    courses: t('courses'),
    revenue: t('revenue'),
    withdrawals: t('withdrawals'),
    coupons: t('coupons'),
    qna: t('qna'),
    settings: t('settings'),
    users: t('users'),
    approvals: t('approvals'),
    instructors: t('instructorApprovals'),
    categories: t('categories'),
    tags: t('tags'),
    'placement-questions': t('placementQuestions'),
    analytics: t('analytics'),
    reports: t('reports'),
    'question-banks': t('questionBanks'),
    new: t('new'),
    edit: t('edit'),
    curriculum: t('curriculum'),
    students: t('students'),
  };

  const basePath = allSegments[0] ? `/${allSegments[0]}` : '';
  // Admin portal must resolve course titles via the admin endpoint, not the
  // instructor one (admin isn't the course owner → instructor route returns 403).
  const isAdmin = allSegments[0] === 'admin';

  return (
    <nav className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <Link href={`${basePath}/dashboard`} className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, index) => {
        const href = basePath + '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;

        // For CUID segments, show course title instead
        const label = isCuid(segment) ? (
          <CourseTitle courseId={segment} isAdmin={isAdmin} />
        ) : (
          labelMap[segment] || segment
        );

        return (
          <span key={segment + index} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className={cn('text-foreground font-medium')}>{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function CourseTitle({ courseId, isAdmin }: { courseId: string; isAdmin: boolean }) {
  // Only one query fires — the other gets an empty id (hooks are `enabled: !!courseId`)
  const adminQuery = useAdminCourseDetail(isAdmin ? courseId : '');
  const instructorQuery = useInstructorCourseDetail(isAdmin ? '' : courseId);
  const data = isAdmin ? adminQuery.data : instructorQuery.data;
  const title = (data?.data as Record<string, unknown>)?.title as string | undefined;

  if (!title) return <span className="animate-pulse">...</span>;

  // Truncate long titles
  const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title;
  return <>{truncated}</>;
}

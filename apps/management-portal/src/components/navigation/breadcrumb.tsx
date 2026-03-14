'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumb() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const allSegments = pathname.split('/').filter(Boolean);
  // Skip the first segment (instructor/admin) for display but keep in href
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
    analytics: t('analytics'),
    reports: t('reports'),
    new: 'New',
    curriculum: 'Curriculum',
  };

  const basePath = allSegments[0] ? `/${allSegments[0]}` : '';

  return (
    <nav className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <Link href={`${basePath}/dashboard`} className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, index) => {
        const href = basePath + '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        const label = labelMap[segment] || segment;

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

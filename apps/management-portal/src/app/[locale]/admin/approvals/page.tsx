'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@shared/ui';
import { Users, BookOpen, ArrowRight } from 'lucide-react';
import { instructorApplications, pendingCourseReviews } from '@/lib/mock-data';

export default function ApprovalsPage() {
  const t = useTranslations('approvals');

  const pendingInstructors = instructorApplications.filter((a) => a.status === 'PENDING').length;
  const pendingCourses = pendingCourseReviews.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="grid grid-cols-2 gap-6">
        <Link href="/admin/approvals/instructors">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('instructorTitle')}</CardTitle>
              <Badge variant="destructive">{pendingInstructors}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <Users className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingInstructors}</p>
                    <p className="text-muted-foreground text-sm">{t('pendingApplications')}</p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/approvals/courses">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('courseTitle')}</CardTitle>
              <Badge variant="destructive">{pendingCourses}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <BookOpen className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingCourses}</p>
                    <p className="text-muted-foreground text-sm">{t('pendingCourses')}</p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

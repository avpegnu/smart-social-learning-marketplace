'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  AvatarSimple,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui';
import { useInstructorCourseStudents, useInstructorCourseDetail, useDebounce } from '@shared/hooks';
import { formatDate } from '@shared/utils';
import { StatCard } from '@/components/data-display/stat-card';

interface EnrolledStudent {
  id: string;
  userId: string;
  type: 'FULL' | 'PARTIAL';
  progress: number;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export default function CourseStudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const t = useTranslations('courseStudents');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const { data: courseData } = useInstructorCourseDetail(courseId);
  const { data, isLoading } = useInstructorCourseStudents(courseId, {
    page,
    limit: 10,
    search: debouncedSearch || undefined,
  });

  const course = courseData?.data as { title: string } | undefined;
  const students = (data?.data ?? []) as EnrolledStudent[];
  const meta = data?.meta;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/instructor/courses/${courseId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{course?.title ?? t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('title')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          label={t('totalStudents')}
          value={String(meta?.total ?? 0)}
          change={0}
          changeLabel=""
          icon="Users"
        />
        <StatCard
          label={t('progress')}
          value={
            students.length > 0
              ? `${Math.round((students.filter((s) => s.progress >= 1).length / students.length) * 100)}%`
              : '0%'
          }
          change={0}
          changeLabel=""
          icon="BookOpen"
        />
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('title')}</CardTitle>
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t('noStudents')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('student')}</TableHead>
                  <TableHead>{t('enrolled')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('progress')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AvatarSimple
                          src={enrollment.user.avatarUrl ?? undefined}
                          alt={enrollment.user.fullName}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium">{enrollment.user.fullName}</p>
                          <p className="text-muted-foreground text-xs">{enrollment.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(enrollment.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={enrollment.type === 'FULL' ? 'default' : 'secondary'}>
                        {enrollment.type === 'FULL' ? t('full') : t('partial')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.round(enrollment.progress * 100)}
                          className="h-2 w-20"
                        />
                        <span className="text-sm tabular-nums">
                          {Math.round(enrollment.progress * 100)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: meta.totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={page === i + 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

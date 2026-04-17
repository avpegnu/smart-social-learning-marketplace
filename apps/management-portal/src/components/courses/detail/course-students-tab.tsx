'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useInstructorCourseStudents, useAdminCourseStudents, useDebounce } from '@shared/hooks';
import { formatDate } from '@shared/utils';

interface EnrolledStudent {
  id: string;
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

interface CourseStudentsTabProps {
  courseId: string;
  mode: 'instructor' | 'admin';
}

export function CourseStudentsTab({ courseId, mode }: CourseStudentsTabProps) {
  const t = useTranslations('courseStudents');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const params = { page, limit: 10, search: debouncedSearch || undefined };

  const instructorQuery = useInstructorCourseStudents(
    mode === 'instructor' ? courseId : '',
    params,
  );
  const adminQuery = useAdminCourseStudents(mode === 'admin' ? courseId : '', params);

  const { data, isLoading, isFetching } = mode === 'instructor' ? instructorQuery : adminQuery;

  const students = (data?.data ?? []) as EnrolledStudent[];
  const meta = data?.meta;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{t('title')}</CardTitle>
            {meta && (
              <p className="text-muted-foreground mt-0.5 text-sm">
                {t('totalStudents')}: <span className="font-semibold">{meta.total}</span>
              </p>
            )}
          </div>
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
        {isLoading || isFetching ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : students.length === 0 ? (
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

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground text-sm">
              {page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === meta.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

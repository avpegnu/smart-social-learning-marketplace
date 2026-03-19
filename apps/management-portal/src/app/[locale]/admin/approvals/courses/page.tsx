'use client';

import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  Button,
  AvatarSimple,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui';
import { Check, X, MessageSquare, Image, Eye } from 'lucide-react';
import { pendingCourseReviews } from '@/lib/mock-data';
import { formatPrice, formatDate } from '@shared/utils';

export default function CourseReviewsPage() {
  const t = useTranslations('approvals');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('courseTitle')}</h1>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>{t('instructor')}</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>{t('submittedDate')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCourseReviews.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="bg-muted flex h-10 w-14 items-center justify-center rounded">
                      <Image className="text-muted-foreground h-4 w-4" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{course.title}</p>
                      <p className="text-muted-foreground text-xs">{course.subtitle}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AvatarSimple alt={course.instructor} size="sm" />
                      <span className="text-sm">{course.instructor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatPrice(course.price)}</TableCell>
                  <TableCell className="text-sm">
                    {course.submittedAt ? formatDate(course.submittedAt) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-success h-8 w-8">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-warning h-8 w-8">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

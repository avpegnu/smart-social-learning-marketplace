'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Progress,
  Skeleton,
} from '@shared/ui';
import { useInstructorCoupons, useDeactivateCoupon } from '@shared/hooks';
import { formatDate, formatPrice } from '@shared/utils';
import { StatusBadge } from '@/components/data-display/status-badge';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

interface CouponCourse {
  courseId: string;
  course: { id: string; title: string };
}

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  couponCourses: CouponCourse[];
}

function computeStatus(c: Coupon): string {
  if (!c.isActive) return 'DISABLED';
  if (new Date(c.endDate) < new Date()) return 'EXPIRED';
  if (new Date(c.startDate) > new Date()) return 'SCHEDULED';
  return 'ACTIVE';
}

export default function CouponsPage() {
  const t = useTranslations('coupons');
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const { data, isLoading } = useInstructorCoupons({ page, limit: 10 });
  const deactivateCoupon = useDeactivateCoupon();

  const coupons = (data?.data ?? []) as Coupon[];
  const meta = data?.meta;

  const handleDeactivate = () => {
    if (!deactivateId) return;
    deactivateCoupon.mutate(deactivateId, {
      onSuccess: () => {
        toast.success(t('couponDeactivated'));
        setDeactivateId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button onClick={() => router.push('/instructor/coupons/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createCoupon')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {coupons.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t('noCoupons')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('discount')}</TableHead>
                  <TableHead>{t('usage')}</TableHead>
                  <TableHead>{t('validPeriod')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const status = computeStatus(coupon);
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <code className="bg-muted rounded px-2 py-1 text-sm font-semibold">
                          {coupon.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {coupon.type === 'PERCENTAGE'
                            ? `${coupon.value}%`
                            : formatPrice(coupon.value)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-sm tabular-nums">
                            {coupon.usageCount}/{coupon.usageLimit ?? '∞'}
                          </span>
                          {coupon.usageLimit && (
                            <Progress
                              value={(coupon.usageCount / coupon.usageLimit) * 100}
                              className="h-1.5"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(coupon.startDate)} — {formatDate(coupon.endDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell>
                        {status === 'ACTIVE' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeactivateId(coupon.id)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

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

      <ConfirmDialog
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title={t('deactivate')}
        description={t('confirmDeactivateDesc')}
        onConfirm={handleDeactivate}
        isLoading={deactivateCoupon.isPending}
        variant="destructive"
      />
    </div>
  );
}

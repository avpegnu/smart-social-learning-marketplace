'use client';

import { useTranslations } from 'next-intl';
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
} from '@shared/ui';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { instructorCoupons } from '@/lib/mock-data';

export default function CouponsPage() {
  const t = useTranslations('coupons');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button>
          <Plus className="h-4 w-4" />
          {t('createCoupon')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
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
              {instructorCoupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <code className="bg-muted rounded px-2 py-1 text-sm font-semibold">
                      {coupon.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {coupon.discountType === 'PERCENT'
                        ? `${coupon.discount}%`
                        : `${coupon.discount.toLocaleString('vi-VN')}₫`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="text-sm tabular-nums">
                        {coupon.usageCount}/{coupon.usageLimit}
                      </span>
                      <Progress
                        value={coupon.usageCount}
                        max={coupon.usageLimit}
                        className="h-1.5"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(coupon.validFrom)} - {formatDate(coupon.validTo)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={coupon.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="text-destructive h-4 w-4" />
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

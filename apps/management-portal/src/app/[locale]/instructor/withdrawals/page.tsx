'use client';

import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shared/ui';
import { StatusBadge } from '@/components/data-display/status-badge';
import { Wallet } from 'lucide-react';
import { instructorWithdrawals, formatCurrency, formatDate } from '@/lib/mock-data';

export default function WithdrawalsPage() {
  const t = useTranslations('withdrawals');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button>
          <Wallet className="h-4 w-4" />
          {t('requestWithdrawal')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead>{t('bank')}</TableHead>
                <TableHead>{t('account')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructorWithdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{formatDate(w.requestedAt)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(w.amount)}
                  </TableCell>
                  <TableCell>{w.bankName}</TableCell>
                  <TableCell className="font-mono text-sm">{w.accountNumber}</TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {w.notes || (w.completedAt ? formatDate(w.completedAt) : '-')}
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

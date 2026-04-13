'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
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
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
} from '@shared/ui';
import {
  useInstructorWithdrawals,
  useRequestWithdrawal,
  useInstructorDashboard,
  usePlatformSettings,
} from '@shared/hooks';
import { formatPrice, formatDate } from '@shared/utils';
import { StatusBadge } from '@/components/data-display/status-badge';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  bankInfo: BankInfo;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

export default function WithdrawalsPage() {
  const t = useTranslations('withdrawals');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const { data, isLoading } = useInstructorWithdrawals({ page, limit: 10 });
  const { data: dashboardData } = useInstructorDashboard();
  const { data: settingsData } = usePlatformSettings();
  const requestWithdrawal = useRequestWithdrawal();

  const MIN_WITHDRAWAL =
    (settingsData?.data as { minimumWithdrawal?: number } | undefined)?.minimumWithdrawal ?? 50000;

  const withdrawals = (data?.data ?? []) as Withdrawal[];
  const meta = data?.meta;
  const dashboard = dashboardData?.data as { overview: { availableBalance: number } } | undefined;
  const availableBalance = dashboard?.overview?.availableBalance ?? 0;
  const hasPending = withdrawals.some((w) => w.status === 'PENDING');

  const openDialog = () => {
    // Pre-fill bank info from last withdrawal if available
    const lastWithdrawal = withdrawals[0];
    if (lastWithdrawal?.bankInfo) {
      setBankName(lastWithdrawal.bankInfo.bankName);
      setAccountNumber(lastWithdrawal.bankInfo.accountNumber);
      setAccountName(lastWithdrawal.bankInfo.accountName);
    }
    setAmount('');
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const amountNum = Number(amount);
    if (amountNum < MIN_WITHDRAWAL || amountNum > availableBalance) return;
    if (!bankName || !accountNumber || !accountName) return;

    requestWithdrawal.mutate(
      {
        amount: amountNum,
        bankInfo: { bankName, accountNumber, accountName },
      },
      {
        onSuccess: () => {
          toast.success(t('success'));
          setDialogOpen(false);
        },
      },
    );
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
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('availableBalance')}: {formatPrice(availableBalance)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={openDialog} disabled={hasPending || availableBalance < MIN_WITHDRAWAL}>
            <Wallet className="mr-2 h-4 w-4" />
            {t('requestWithdrawal')}
          </Button>
          {hasPending && <p className="text-muted-foreground text-xs">{t('pendingExists')}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t('noWithdrawals')}</p>
          ) : (
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
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{formatDate(w.createdAt)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPrice(w.amount)}
                    </TableCell>
                    <TableCell>{w.bankInfo.bankName}</TableCell>
                    <TableCell className="font-mono text-sm">{w.bankInfo.accountNumber}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-50 truncate text-sm">
                      {w.reviewNote ?? '—'}
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

      {/* Request Withdrawal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('requestWithdrawal')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('requestAmount')}</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${MIN_WITHDRAWAL.toLocaleString()}`}
                min={MIN_WITHDRAWAL}
                max={availableBalance}
              />
              <p className="text-muted-foreground text-xs">
                {t('minAmount', { amount: formatPrice(MIN_WITHDRAWAL) })} •{' '}
                {t('maxAmount', { amount: formatPrice(availableBalance) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('bankName')}</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="MB Bank, Vietcombank..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t('accountNumber')}</Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('accountName')}</Label>
              <Input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="NGUYEN VAN A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                requestWithdrawal.isPending ||
                !amount ||
                Number(amount) < MIN_WITHDRAWAL ||
                Number(amount) > availableBalance ||
                !bankName ||
                !accountNumber ||
                !accountName
              }
            >
              {requestWithdrawal.isPending ? t('pending') : t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

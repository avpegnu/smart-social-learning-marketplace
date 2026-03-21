'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { AvatarSimple, Badge, Button, Input } from '@shared/ui';
import { Ban, ShieldCheck } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { useAdminUsers, useUpdateUserStatus, useDebounce } from '@shared/hooks';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count?: { enrollments: number };
}

export default function UsersPage() {
  const t = useTranslations('users');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // Action state
  const [actionTarget, setActionTarget] = useState<{
    user: UserRow;
    action: 'SUSPEND' | 'ACTIVATE';
  } | null>(null);
  const [reason, setReason] = useState('');

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '10' };
    if (debouncedSearch) p.search = debouncedSearch;
    if (roleFilter !== 'ALL') p.role = roleFilter;
    if (statusFilter !== 'ALL') p.status = statusFilter;
    return p;
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  const { data, isLoading } = useAdminUsers(params);
  const updateStatus = useUpdateUserStatus();

  const users = (data?.data as UserRow[]) ?? [];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  const roleLabels: Record<string, string> = {
    STUDENT: t('student'),
    INSTRUCTOR: t('instructor'),
    ADMIN: t('admin'),
  };

  const handleAction = () => {
    if (!actionTarget) return;
    const newStatus = actionTarget.action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
    updateStatus.mutate(
      { userId: actionTarget.user.id, data: { status: newStatus, reason: reason || undefined } },
      {
        onSuccess: () => {
          toast.success(
            actionTarget.action === 'SUSPEND' ? t('userSuspended') : t('userActivated'),
          );
          setActionTarget(null);
          setReason('');
        },
      },
    );
  };

  const columns: Column<UserRow>[] = [
    {
      key: 'fullName',
      header: t('name'),
      render: (user) => (
        <div className="flex items-center gap-3">
          <AvatarSimple src={user.avatarUrl ?? undefined} alt={user.fullName} size="sm" />
          <div>
            <p className="font-medium">{user.fullName}</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('role'),
      render: (user) => <Badge variant="secondary">{roleLabels[user.role] ?? user.role}</Badge>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (user) => (
        <Badge variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}>
          {user.status === 'ACTIVE' ? t('active') : t('suspended')}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: t('joinedDate'),
      render: (user) => <span className="text-sm">{formatDate(user.createdAt)}</span>,
    },
    {
      key: 'enrollments',
      header: t('courses'),
      render: (user) => <span className="text-sm">{user._count?.enrollments ?? 0}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (user) => {
        if (user.role === 'ADMIN') return null;
        return user.status === 'ACTIVE' ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setActionTarget({ user, action: 'SUSPEND' })}
          >
            <Ban className="mr-1 h-3.5 w-3.5" />
            {t('suspend')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionTarget({ user, action: 'ACTIVATE' })}
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {t('activate')}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={t('searchPlaceholder')}
        serverPage={meta?.page}
        serverTotalPages={meta?.totalPages}
        serverTotal={meta?.total}
        onServerPageChange={setPage}
        filterSlot={
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">{t('role')}:</span>
              <div className="flex items-center gap-1">
                {['ALL', 'STUDENT', 'INSTRUCTOR', 'ADMIN'].map((r) => (
                  <Badge
                    key={r}
                    variant={roleFilter === r ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1 text-sm"
                    onClick={() => {
                      setRoleFilter(r);
                      setPage(1);
                    }}
                  >
                    {r === 'ALL' ? t('allRoles') : (roleLabels[r] ?? r)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="bg-border h-6 w-px" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">{t('status')}:</span>
              <div className="flex items-center gap-1">
                {['ALL', 'ACTIVE', 'SUSPENDED'].map((s) => (
                  <Badge
                    key={s}
                    variant={statusFilter === s ? 'default' : 'outline'}
                    className="cursor-pointer px-3 py-1 text-sm"
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(1);
                    }}
                  >
                    {s === 'ALL' ? t('allStatuses') : s === 'ACTIVE' ? t('active') : t('suspended')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        }
      />

      {/* Suspend/Activate Dialog */}
      <ConfirmDialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null);
            setReason('');
          }
        }}
        title={actionTarget?.action === 'SUSPEND' ? t('confirmSuspend') : t('confirmActivate')}
        description={
          actionTarget?.action === 'SUSPEND'
            ? t('confirmSuspendDesc', { name: actionTarget?.user.fullName ?? '' })
            : t('confirmActivateDesc', { name: actionTarget?.user.fullName ?? '' })
        }
        confirmLabel={actionTarget?.action === 'SUSPEND' ? t('suspend') : t('activate')}
        variant={actionTarget?.action === 'SUSPEND' ? 'destructive' : 'default'}
        isLoading={updateStatus.isPending}
        onConfirm={handleAction}
      >
        {actionTarget?.action === 'SUSPEND' && (
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            className="mt-2"
          />
        )}
      </ConfirmDialog>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { AvatarSimple, Badge, Button } from '@shared/ui';
import { Pencil, Ban, Eye } from 'lucide-react';
import { formatDate } from '@shared/utils';
import { adminUsers, type User } from '@/lib/mock-data';

export default function UsersPage() {
  const t = useTranslations('users');
  const [roleFilter, setRoleFilter] = React.useState('ALL');
  const [statusFilter, setStatusFilter] = React.useState('ALL');

  let filteredData = adminUsers;
  if (roleFilter !== 'ALL') filteredData = filteredData.filter((u) => u.role === roleFilter);
  if (statusFilter !== 'ALL') filteredData = filteredData.filter((u) => u.status === statusFilter);

  const roleLabel: Record<string, string> = {
    STUDENT: t('student'),
    INSTRUCTOR: t('instructor'),
    ADMIN: t('admin'),
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: t('name'),
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <AvatarSimple alt={user.name} size="sm" />
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('role'),
      render: (user) => <Badge variant="secondary">{roleLabel[user.role] || user.role}</Badge>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: 'joinedAt',
      header: t('joinedDate'),
      sortable: true,
      render: (user) => <span className="text-sm">{formatDate(user.joinedAt)}</span>,
    },
    {
      key: 'actions',
      header: t('actions'),
      render: () => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Ban className="text-destructive h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <DataTable
        columns={columns}
        data={filteredData}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchKey="name"
        pageSize={8}
        filterSlot={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {['ALL', 'STUDENT', 'INSTRUCTOR', 'ADMIN'].map((r) => (
                <Badge
                  key={r}
                  variant={roleFilter === r ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setRoleFilter(r)}
                >
                  {r === 'ALL' ? t('filterByRole') : roleLabel[r] || r}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {['ALL', 'ACTIVE', 'INACTIVE', 'BANNED'].map((s) => (
                <Badge
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'ALL'
                    ? t('filterByStatus')
                    : t(s.toLowerCase() as 'active' | 'inactive' | 'banned')}
                </Badge>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}

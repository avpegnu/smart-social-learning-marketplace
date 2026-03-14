'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/data-display/data-table';
import { StatusBadge } from '@/components/data-display/status-badge';
import { AvatarSimple, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui';
import { Eye, ShieldBan, XCircle } from 'lucide-react';
import {
  contentReports,
  userReports,
  formatDate,
  type Report,
  type UserReport,
} from '@/lib/mock-data';

export default function ReportsPage() {
  const t = useTranslations('reports');

  const contentTypeLabel: Record<string, string> = {
    POST: t('post'),
    COMMENT: t('comment'),
    COURSE: t('course'),
  };

  const contentColumns: Column<Report>[] = [
    {
      key: 'reporterName',
      header: t('reporter'),
      render: (item) => (
        <div className="flex items-center gap-2">
          <AvatarSimple alt={item.reporterName} size="sm" />
          <span className="text-sm font-medium">{item.reporterName}</span>
        </div>
      ),
    },
    {
      key: 'contentType',
      header: t('contentType'),
      render: (item) => (
        <Badge variant="secondary">{contentTypeLabel[item.contentType] || item.contentType}</Badge>
      ),
    },
    {
      key: 'contentPreview',
      header: t('contentPreview'),
      className: 'max-w-[250px]',
      render: (item) => (
        <p className="text-muted-foreground truncate text-sm">{item.contentPreview}</p>
      ),
    },
    {
      key: 'reason',
      header: t('reason'),
      render: (item) => <span className="text-sm">{item.reason}</span>,
    },
    {
      key: 'reportedAt',
      header: t('reportedDate'),
      sortable: true,
      render: (item) => <span className="text-sm">{formatDate(item.reportedAt)}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (item) =>
        item.status === 'PENDING' ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('review')}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('dismiss')}>
              <XCircle className="text-muted-foreground h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('ban')}>
              <ShieldBan className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const userColumns: Column<UserReport>[] = [
    {
      key: 'reportedUserName',
      header: t('reportedUser'),
      render: (item) => (
        <div className="flex items-center gap-2">
          <AvatarSimple alt={item.reportedUserName} size="sm" />
          <span className="text-sm font-medium">{item.reportedUserName}</span>
        </div>
      ),
    },
    {
      key: 'reporterName',
      header: t('reporter'),
      render: (item) => <span className="text-sm">{item.reporterName}</span>,
    },
    {
      key: 'reason',
      header: t('reason'),
      render: (item) => <span className="text-sm">{item.reason}</span>,
    },
    {
      key: 'reportCount',
      header: t('reportCount'),
      sortable: true,
      render: (item) => (
        <Badge variant={item.reportCount >= 4 ? 'destructive' : 'secondary'}>
          {item.reportCount}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: t('actions'),
      render: (item) =>
        item.status === 'PENDING' ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('review')}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t('ban')}>
              <ShieldBan className="text-destructive h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">{t('reportedContent')}</TabsTrigger>
          <TabsTrigger value="users">{t('reportedUsers')}</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <DataTable
            columns={contentColumns}
            data={contentReports}
            searchable
            searchPlaceholder={t('searchPlaceholder')}
            searchKey="reporterName"
            pageSize={8}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <DataTable
            columns={userColumns}
            data={userReports}
            searchable
            searchPlaceholder={t('searchPlaceholder')}
            searchKey="reportedUserName"
            pageSize={8}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

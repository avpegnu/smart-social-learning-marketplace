'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Inbox, Check, X } from 'lucide-react';
import { Card, CardContent, Avatar, AvatarImage, AvatarFallback, Button } from '@shared/ui';
import { useJoinRequests, useApproveRequest, useRejectRequest } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { Link } from '@/i18n/navigation';
import { EmptyState } from '@/components/feedback/empty-state';

interface RequestUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface JoinRequest {
  id: string;
  user: RequestUser;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface RequestsResponse {
  data?: JoinRequest[];
  meta?: { page: number; totalPages: number; total: number };
}

interface GroupRequestsTabProps {
  groupId: string;
}

export function GroupRequestsTab({ groupId }: GroupRequestsTabProps) {
  const t = useTranslations('groups');
  const [page, setPage] = useState(1);

  const { data: requestsRaw, isLoading } = useJoinRequests(groupId, { page, limit: 20 });
  const requests = (requestsRaw as RequestsResponse)?.data ?? [];
  const meta = (requestsRaw as RequestsResponse)?.meta;

  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  function handleApprove(requestId: string) {
    approveRequest.mutate({ groupId, requestId });
  }

  function handleReject(requestId: string) {
    rejectRequest.mutate({ groupId, requestId });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return <EmptyState icon={Inbox} title={t('noRequests')} />;
  }

  return (
    <div className="max-w-2xl space-y-2">
      {requests.map((request) => {
        const initials = request.user.fullName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const isPending = request.status === 'PENDING';

        return (
          <Card key={request.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${request.user.id}`}>
                  <Avatar className="h-10 w-10">
                    {request.user.avatarUrl && (
                      <AvatarImage src={request.user.avatarUrl} alt={request.user.fullName} />
                    )}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/profile/${request.user.id}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {request.user.fullName}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {formatRelativeTime(request.createdAt)}
                  </p>
                </div>

                {isPending && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleApprove(request.id)}
                      disabled={approveRequest.isPending}
                    >
                      {approveRequest.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {t('approve')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectRequest.isPending}
                    >
                      {rejectRequest.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {t('reject')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('previous')}
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

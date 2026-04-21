'use client';

import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { Card, CardContent, Skeleton } from '@shared/ui';
import { useGroups } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

export function GroupsSidebar() {
  const t = useTranslations('social');
  const tGroups = useTranslations('groups');
  const { data, isLoading } = useGroups({ limit: 3 } as Record<string, unknown>);
  const groups =
    (data as { data?: { id: string; name: string; memberCount: number }[] })?.data ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-primary h-4 w-4" />
            <h2 className="text-sm font-semibold">{t('groups')}</h2>
          </div>
          <Link href="/social/groups" className="text-primary text-xs hover:underline">
            {tGroups('viewAll')}
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        )}

        <ul className="space-y-1">
          {groups.map((group) => {
            const initials = group.name
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <li key={group.id}>
                <Link
                  href={`/social/groups/${group.id}`}
                  className="hover:bg-accent flex items-center gap-2 rounded-md p-1.5 transition-colors"
                >
                  <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{group.name}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {group.memberCount.toLocaleString()} {tGroups('members')}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

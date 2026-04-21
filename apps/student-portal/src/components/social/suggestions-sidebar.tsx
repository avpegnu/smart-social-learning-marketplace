'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, Loader2 } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@shared/ui';
import { useSuggestedUsers, useFollowUser, useUnfollowUser } from '@shared/hooks';
import { Link } from '@/i18n/navigation';

export function SuggestionsSidebar() {
  const t = useTranslations('social');
  const { data, isLoading } = useSuggestedUsers();
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Handle both { data: T[] } and { data: { data: T[] } } for compatibility during reload
  const rawData = data?.data as unknown;
  const suggestionsArray = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as Record<string, unknown>)?.data)
      ? ((rawData as Record<string, unknown>).data as unknown[])
      : [];

  const suggestions = suggestionsArray as {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    followerCount: number;
    isFollowing: boolean;
  }[];

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="text-primary h-4 w-4" />
          <h2 className="text-sm font-semibold">{t('suggestions')}</h2>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        )}

        <ul className="space-y-3">
          {suggestions.map((user) => {
            const initials = user.fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={user.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/profile/${user.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 transition-opacity hover:opacity-80"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="block truncate text-xs font-medium">{user.fullName}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {user.followerCount.toLocaleString()} followers
                    </p>
                  </div>
                </Link>
                <Button
                  size="sm"
                  variant={user.isFollowing ? 'outline' : 'default'}
                  className="h-7 shrink-0 px-3 text-xs"
                  disabled={pendingUserId === user.id}
                  onClick={(e) => {
                    e.preventDefault();
                    setPendingUserId(user.id);
                    if (user.isFollowing) {
                      unfollowUser.mutate(user.id, {
                        onSettled: () => setPendingUserId(null),
                      });
                    } else {
                      followUser.mutate(user.id, {
                        onSettled: () => setPendingUserId(null),
                      });
                    }
                  }}
                >
                  {pendingUserId === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    t('follow')
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarImage, AvatarFallback } from '@shared/ui';

interface UserResult {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface UserSearchItemProps {
  user: UserResult;
  onClick: (userId: string) => void;
}

export function UserSearchItem({ user, onClick }: UserSearchItemProps) {
  const t = useTranslations('chat');

  return (
    <button
      onClick={() => onClick(user.id)}
      className="hover:bg-accent/50 group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors"
    >
      <Avatar className="h-9 w-9">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
        <AvatarFallback className="text-xs">{user.fullName[0]}</AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate text-left text-sm font-medium">{user.fullName}</span>
      <span className="text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
        {t('startChat')}
      </span>
    </button>
  );
}

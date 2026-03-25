'use client';

import { useTranslations } from 'next-intl';

interface TypingIndicatorProps {
  typingUserNames: string[];
}

export function TypingIndicator({ typingUserNames }: TypingIndicatorProps) {
  const t = useTranslations('chat');

  if (typingUserNames.length === 0) return null;

  const displayName = typingUserNames[0];

  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div
              className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="bg-muted-foreground/50 h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-muted-foreground text-xs">
            {displayName} {t('typing')}
          </span>
        </div>
      </div>
    </div>
  );
}

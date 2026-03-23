'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  voteCount: number;
  userVote: number | null;
  onVote: (value: number) => void;
  disabled?: boolean;
}

export function VoteButtons({ voteCount, userVote, onVote, disabled }: VoteButtonsProps) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote(userVote === 1 ? 0 : 1)}
        className={cn(
          'cursor-pointer rounded p-0.5 transition-colors disabled:cursor-default disabled:opacity-50',
          userVote === 1
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-primary',
        )}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span
        className={cn(
          'text-sm font-bold',
          voteCount > 0 && 'text-primary',
          voteCount < 0 && 'text-destructive',
        )}
      >
        {voteCount}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote(userVote === -1 ? 0 : -1)}
        className={cn(
          'cursor-pointer rounded p-0.5 transition-colors disabled:cursor-default disabled:opacity-50',
          userVote === -1
            ? 'text-destructive bg-destructive/10'
            : 'text-muted-foreground hover:text-destructive',
        )}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

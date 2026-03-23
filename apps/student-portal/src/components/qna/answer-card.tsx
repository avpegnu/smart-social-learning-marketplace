'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Card, CardContent, Badge, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { useVoteAnswer, useDeleteAnswer, useMarkBestAnswer } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { VoteButtons } from './vote-buttons';
import { CodeBlock } from './code-block';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { cn } from '@/lib/utils';

interface Author {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface AnswerData {
  id: string;
  content: string;
  codeSnippet?: { language: string; code: string } | null;
  voteCount: number;
  userVote?: number | null;
  createdAt: string;
  author: Author;
}

interface AnswerCardProps {
  answer: AnswerData;
  questionId: string;
  isBestAnswer: boolean;
  canMarkBest: boolean;
  isOwner: boolean;
}

export function AnswerCard({
  answer,
  questionId,
  isBestAnswer,
  canMarkBest,
  isOwner,
}: AnswerCardProps) {
  const t = useTranslations('questionDetail');
  const [localVote, setLocalVote] = useState<number | null>(answer.userVote ?? null);
  const [localVoteCount, setLocalVoteCount] = useState(answer.voteCount);
  const [showDelete, setShowDelete] = useState(false);

  const voteAnswer = useVoteAnswer();
  const deleteAnswer = useDeleteAnswer();
  const markBest = useMarkBestAnswer();

  function handleVote(value: number) {
    const prev = localVote;
    const prevCount = localVoteCount;

    if (value === 0) {
      setLocalVote(null);
      setLocalVoteCount(prevCount - (prev ?? 0));
    } else {
      setLocalVote(value);
      setLocalVoteCount(prevCount - (prev ?? 0) + value);
    }

    voteAnswer.mutate(
      { answerId: answer.id, value, questionId },
      {
        onError: () => {
          setLocalVote(prev);
          setLocalVoteCount(prevCount);
        },
      },
    );
  }

  return (
    <>
      <Card className={cn(isBestAnswer && 'border-success/50')}>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <VoteButtons voteCount={localVoteCount} userVote={localVote} onVote={handleVote} />
              {isBestAnswer && <CheckCircle2 className="text-success mt-1 h-5 w-5" />}
            </div>

            <div className="min-w-0 flex-1">
              {isBestAnswer && (
                <Badge variant="outline" className="text-success border-success/30 mb-2 text-xs">
                  {t('bestAnswer')}
                </Badge>
              )}
              <p className="mb-3 text-sm whitespace-pre-wrap">{answer.content}</p>
              {answer.codeSnippet && (
                <CodeBlock codeSnippet={answer.codeSnippet as { language: string; code: string }} />
              )}
              <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    {answer.author.avatarUrl && <AvatarImage src={answer.author.avatarUrl} />}
                    <AvatarFallback className="text-[8px]">
                      {answer.author.fullName?.[0] ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{answer.author.fullName}</span>
                </div>
                <span>{formatRelativeTime(answer.createdAt)}</span>
                <div className="ml-auto flex items-center gap-2">
                  {canMarkBest && !isBestAnswer && (
                    <button
                      type="button"
                      onClick={() => markBest.mutate({ questionId, answerId: answer.id })}
                      className="text-muted-foreground hover:text-success flex cursor-pointer items-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t('markBest')}</span>
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowDelete(true)}
                      className="text-destructive hover:text-destructive/80 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t('deleteAnswer')}
        description={t('confirmDelete')}
        variant="destructive"
        onConfirm={() => deleteAnswer.mutate({ answerId: answer.id, questionId })}
      />
    </>
  );
}

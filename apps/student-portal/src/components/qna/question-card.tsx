'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MessageSquare, Eye, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, Badge, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { formatRelativeTime } from '@shared/utils';
import { cn } from '@/lib/utils';

interface QuestionAuthor {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface QuestionCardProps {
  question: {
    id: string;
    title: string;
    content: string;
    answerCount: number;
    viewCount: number;
    hasBestAnswer?: boolean;
    bestAnswerId?: string | null;
    createdAt: string;
    author: QuestionAuthor;
    course?: { id: string; title: string } | null;
    tag?: { id: string; name: string } | null;
  };
}

export function QuestionCard({ question }: QuestionCardProps) {
  const t = useTranslations('qna');
  const resolved = question.hasBestAnswer ?? !!question.bestAnswerId;

  return (
    <Link href={`/qna/${question.id}`}>
      <Card className="hover:border-primary/30 transition-colors">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                {resolved && (
                  <Badge variant="outline" className="text-success border-success/30 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('resolved')}
                  </Badge>
                )}
              </div>
              <h3 className="hover:text-primary line-clamp-2 text-sm font-semibold transition-colors">
                {question.title}
              </h3>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{question.content}</p>

              {(question.course || question.tag) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {question.course && (
                    <Badge variant="secondary" className="text-xs">
                      {question.course.title}
                    </Badge>
                  )}
                  {question.tag && (
                    <Badge variant="outline" className="text-xs">
                      {question.tag.name}
                    </Badge>
                  )}
                </div>
              )}

              <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    {question.author.avatarUrl && <AvatarImage src={question.author.avatarUrl} />}
                    <AvatarFallback className="text-[8px]">
                      {question.author.fullName?.[0] ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{question.author.fullName}</span>
                </div>
                <span>{formatRelativeTime(question.createdAt)}</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {question.answerCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {question.viewCount}
                </span>
              </div>
            </div>

            {/* Answer count badge */}
            <div className="hidden shrink-0 flex-col items-center sm:flex">
              <div
                className={cn(
                  'flex h-12 w-12 flex-col items-center justify-center rounded-lg text-xs',
                  resolved
                    ? 'bg-success/10 text-success border-success/30 border'
                    : question.answerCount > 0
                      ? 'bg-primary/10 text-primary border-primary/30 border'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                <span className="text-base font-bold">{question.answerCount}</span>
                <span className="text-[10px]">{t('ans')}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

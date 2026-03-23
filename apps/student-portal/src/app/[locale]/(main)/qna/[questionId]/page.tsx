'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { ArrowLeft, MessageSquare, Eye, Trash2, Loader2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
} from '@shared/ui';
import { useQuestionDetail, useDeleteQuestion, useAuthStore } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';
import { CodeBlock } from '@/components/qna/code-block';
import { AnswerCard } from '@/components/qna/answer-card';
import { AnswerForm } from '@/components/qna/answer-form';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';

interface Author {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface AnswerData {
  id: string;
  content: string;
  codeSnippet?: { language: string; code: string } | null;
  voteCount: number;
  userVote?: number | null;
  createdAt: string;
  author: Author;
}

interface QuestionData {
  id: string;
  title: string;
  content: string;
  codeSnippet?: { language: string; code: string } | null;
  answerCount: number;
  viewCount: number;
  bestAnswerId?: string | null;
  createdAt: string;
  author: Author;
  course?: { id: string; title: string } | null;
  tag?: { id: string; name: string } | null;
  answers: AnswerData[];
}

export default function QuestionDetailPage() {
  const t = useTranslations('questionDetail');
  const params = useParams();
  const router = useRouter();
  const questionId = params.questionId as string;

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: raw, isLoading } = useQuestionDetail(questionId);
  const question = (raw as { data?: QuestionData } | undefined)?.data;

  const deleteQuestion = useDeleteQuestion();
  const [showDeleteQuestion, setShowDeleteQuestion] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-muted-foreground py-20 text-center">
        <p>{t('notFound')}</p>
      </div>
    );
  }

  const isQuestionOwner = user?.id === question.author.id;
  const canMarkBest = isQuestionOwner;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/qna">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {t('backToQna')}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          {/* Question */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h1 className="mb-3 text-xl font-bold">{question.title}</h1>
              <p className="text-foreground mb-4 text-sm whitespace-pre-wrap">{question.content}</p>

              {question.codeSnippet && (
                <CodeBlock
                  codeSnippet={question.codeSnippet as { language: string; code: string }}
                />
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
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

              <Separator className="my-4" />

              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
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
                  <Eye className="h-3.5 w-3.5" />
                  {question.viewCount} {t('views')}
                </span>
                {isQuestionOwner && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteQuestion(true)}
                    className="text-destructive hover:text-destructive/80 ml-auto cursor-pointer text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Answers */}
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5" />
            {question.answerCount} {t('answers')}
          </h2>

          <div className="mb-8 space-y-4">
            {question.answers.map((answer) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                questionId={question.id}
                isBestAnswer={question.bestAnswerId === answer.id}
                canMarkBest={canMarkBest}
                isOwner={user?.id === answer.author.id}
              />
            ))}
          </div>

          {isAuthenticated ? (
            <AnswerForm questionId={question.id} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">{t('loginToAnswer')}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="hidden w-80 shrink-0 lg:block">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">{t('relatedQuestions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{t('noRelated')}</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={showDeleteQuestion}
        onOpenChange={setShowDeleteQuestion}
        title={t('deleteQuestion')}
        description={t('confirmDelete')}
        variant="destructive"
        onConfirm={() =>
          deleteQuestion.mutate(question.id, {
            onSuccess: () => router.push('/qna'),
          })
        }
      />
    </div>
  );
}

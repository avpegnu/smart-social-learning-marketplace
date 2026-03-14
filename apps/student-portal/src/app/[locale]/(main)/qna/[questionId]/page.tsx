'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
  Eye,
  Send,
  ArrowLeft,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Avatar,
  AvatarFallback,
  Separator,
} from '@shared/ui';
import { mockQuestions, mockAnswers } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export default function QuestionDetailPage() {
  const t = useTranslations('questionDetail');
  const question = mockQuestions[0];
  const relatedQuestions = mockQuestions.slice(1, 4);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/qna">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Question */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                {/* Votes */}
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <button className="text-muted-foreground hover:text-primary cursor-pointer">
                    <ChevronUp className="h-6 w-6" />
                  </button>
                  <span className="text-lg font-bold">{question.votes}</span>
                  <button className="text-muted-foreground hover:text-destructive cursor-pointer">
                    <ChevronDown className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h1 className="mb-3 text-xl font-bold">{question.title}</h1>
                  <p className="text-foreground mb-4 text-sm whitespace-pre-wrap">
                    {question.body}
                  </p>

                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {question.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[8px]">
                          {question.author.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      {question.author.name}
                    </div>
                    <span>{question.createdAt}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {question.views} {t('views')}
                    </span>
                    {question.courseTitle && (
                      <span className="text-primary">{question.courseTitle}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Answers */}
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5" />
            {mockAnswers.length} {t('answers')}
          </h2>

          <div className="mb-8 space-y-4">
            {mockAnswers.map((answer) => (
              <Card key={answer.id} className={cn(answer.isBestAnswer && 'border-success')}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    {/* Votes */}
                    <div className="flex shrink-0 flex-col items-center gap-0.5">
                      <button className="text-muted-foreground hover:text-primary cursor-pointer">
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <span className="text-sm font-bold">{answer.votes}</span>
                      <button className="text-muted-foreground hover:text-destructive cursor-pointer">
                        <ChevronDown className="h-5 w-5" />
                      </button>
                      {answer.isBestAnswer && (
                        <CheckCircle2 className="text-success mt-1 h-5 w-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {answer.isBestAnswer && (
                        <Badge variant="success" className="mb-2">
                          {t('bestAnswer')}
                        </Badge>
                      )}
                      <p className="mb-3 text-sm whitespace-pre-wrap">{answer.content}</p>
                      <div className="text-muted-foreground flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px]">
                              {answer.author.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          {answer.author.name}
                        </div>
                        <span>{answer.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Answer Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('yourAnswer')}</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring mb-4 min-h-[150px] w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                placeholder={t('answerPlaceholder')}
              />
              <Button className="gap-1.5">
                <Send className="h-4 w-4" />
                {t('submitAnswer')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">{t('relatedQuestions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {relatedQuestions.map((q) => (
                  <div key={q.id}>
                    <Link
                      href={`/qna/${q.id}`}
                      className="hover:text-primary line-clamp-2 text-sm font-medium transition-colors"
                    >
                      {q.title}
                    </Link>
                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                      <span>{q.votes} votes</span>
                      <span>
                        {q.answers} {t('answers')}
                      </span>
                    </div>
                    <Separator className="mt-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

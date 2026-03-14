'use client';

import { useTranslations } from 'next-intl';
import { Search, ChevronUp, ChevronDown, MessageSquare, Eye, Plus } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  Badge,
  Avatar,
  AvatarFallback,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { mockQuestions } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

function QuestionCard({ question }: { question: (typeof mockQuestions)[0] }) {
  const t = useTranslations('qna');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4">
          {/* Vote */}
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <button className="text-muted-foreground hover:text-primary cursor-pointer">
              <ChevronUp className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold">{question.votes}</span>
            <button className="text-muted-foreground hover:text-destructive cursor-pointer">
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h3 className="hover:text-primary cursor-pointer text-sm font-semibold transition-colors">
              {question.title}
            </h3>
            {question.courseTitle && (
              <p className="text-muted-foreground mt-1 text-xs">{question.courseTitle}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {question.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px]">{question.author.name[0]}</AvatarFallback>
                </Avatar>
                {question.author.name}
              </div>
              <span>{question.createdAt}</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {question.answers} {t('answers')}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {question.views}
              </span>
            </div>
          </div>

          {/* Answer count badge */}
          <div className="hidden shrink-0 flex-col items-center sm:flex">
            <div
              className={cn(
                'flex h-12 w-12 flex-col items-center justify-center rounded-lg text-xs',
                question.answers > 0
                  ? 'bg-success/10 text-success border-success/30 border'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <span className="text-base font-bold">{question.answers}</span>
              <span className="text-[10px]">{t('ans')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QnaPage() {
  const t = useTranslations('qna');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('askQuestion')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input placeholder={t('searchPlaceholder')} className="h-12 rounded-xl pl-12" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recent">
        <TabsList className="mb-6">
          <TabsTrigger value="recent">{t('recent')}</TabsTrigger>
          <TabsTrigger value="popular">{t('popular')}</TabsTrigger>
          <TabsTrigger value="unanswered">{t('unanswered')}</TabsTrigger>
          <TabsTrigger value="myCourses">{t('myCourses')}</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <div className="space-y-4">
            {mockQuestions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="popular">
          <div className="space-y-4">
            {[...mockQuestions]
              .sort((a, b) => b.votes - a.votes)
              .map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="unanswered">
          <div className="space-y-4">
            {mockQuestions
              .filter((q) => q.answers < 3)
              .map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="myCourses">
          <div className="space-y-4">
            {mockQuestions
              .filter((q) => q.courseTitle)
              .map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

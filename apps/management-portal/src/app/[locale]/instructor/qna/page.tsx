'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MessageCircle, Clock, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  Badge,
  Button,
  AvatarSimple,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
} from '@shared/ui';
import { useQuestions, useCreateAnswer, useInstructorCourses, useAuthStore } from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';

interface QuestionAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface Question {
  id: string;
  title: string;
  content: string;
  answerCount: number;
  bestAnswerId: string | null;
  hasBestAnswer: boolean;
  createdAt: string;
  author: QuestionAuthor;
  course: { id: string; title: string } | null;
}

interface InstructorCourse {
  id: string;
  title: string;
  status: string;
}

export default function QnAPage() {
  const t = useTranslations('qna');
  const user = useAuthStore((s) => s.user);
  const [courseFilter, setCourseFilter] = useState<string | undefined>(undefined);
  const [statusTab, setStatusTab] = useState<'all' | 'answered' | 'unanswered'>('all');
  const [page, setPage] = useState(1);
  const [answerQuestionId, setAnswerQuestionId] = useState<string | null>(null);
  const [answerContent, setAnswerContent] = useState('');

  const { data: coursesData } = useInstructorCourses({ limit: 100 });
  const courses = ((coursesData?.data ?? []) as InstructorCourse[]).filter(
    (c) => c.status === 'PUBLISHED',
  );

  const { data, isLoading } = useQuestions({
    instructorId: user?.id ?? '',
    courseId: courseFilter,
    status: statusTab === 'all' ? undefined : statusTab,
    page,
    limit: 10,
  });

  const createAnswer = useCreateAnswer();

  const questions = (data?.data ?? []) as Question[];
  const meta = data?.meta;

  const answerQuestion = questions.find((q) => q.id === answerQuestionId);

  const handleSubmitAnswer = () => {
    if (!answerQuestionId || !answerContent.trim()) return;
    createAnswer.mutate(
      { questionId: answerQuestionId, content: answerContent.trim() },
      {
        onSuccess: () => {
          toast.success(t('answerSubmitted'));
          setAnswerQuestionId(null);
          setAnswerContent('');
        },
      },
    );
  };

  const renderQuestions = (items: Question[]) => (
    <div className="mt-4 space-y-3">
      {items.map((q) => (
        <Card key={q.id}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AvatarSimple
                src={q.author.avatarUrl ?? undefined}
                alt={q.author.fullName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{q.author.fullName}</span>
                  {q.hasBestAnswer && <CheckCircle2 className="text-success h-4 w-4" />}
                </div>
                <p className="mb-1 text-sm font-medium">{q.title}</p>
                <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">{q.content}</p>
                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  {q.course && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {q.course.title}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {q.answerCount} {t('answers')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(q.createdAt)}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnswerQuestionId(q.id);
                  setAnswerContent('');
                }}
              >
                {t('reply')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">{t('noQuestions')}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Course filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={!courseFilter ? 'default' : 'outline'}
          className="cursor-pointer px-3 py-1 text-sm"
          onClick={() => {
            setCourseFilter(undefined);
            setPage(1);
          }}
        >
          {t('allCourses')}
        </Badge>
        {courses.map((course) => (
          <Badge
            key={course.id}
            variant={courseFilter === course.id ? 'default' : 'outline'}
            className="cursor-pointer px-3 py-1 text-sm"
            onClick={() => {
              setCourseFilter(course.id);
              setPage(1);
            }}
          >
            {course.title}
          </Badge>
        ))}
      </div>

      {/* Status tabs */}
      <Tabs
        defaultValue="all"
        value={statusTab}
        onValueChange={(v) => {
          setStatusTab(v as 'all' | 'answered' | 'unanswered');
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">{t('allQuestions')}</TabsTrigger>
          <TabsTrigger value="unanswered">{t('unanswered')}</TabsTrigger>
          <TabsTrigger value="answered">{t('answered')}</TabsTrigger>
        </TabsList>
        <TabsContent value={statusTab}>{renderQuestions(questions)}</TabsContent>
      </Tabs>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: meta.totalPages }, (_, i) => (
            <Button
              key={i}
              variant={page === i + 1 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}

      {/* Answer Dialog */}
      <Dialog open={!!answerQuestionId} onOpenChange={(open) => !open && setAnswerQuestionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('answerDialog')}</DialogTitle>
          </DialogHeader>
          {answerQuestion && (
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-sm font-medium">{answerQuestion.title}</p>
              <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                {answerQuestion.content}
              </p>
            </div>
          )}
          <Textarea
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            placeholder={t('answerPlaceholder')}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnswerQuestionId(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSubmitAnswer}
              disabled={!answerContent.trim() || createAnswer.isPending}
            >
              {t('submitAnswer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

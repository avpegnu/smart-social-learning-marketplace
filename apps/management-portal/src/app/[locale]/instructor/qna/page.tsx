'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
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
} from '@shared/ui';
import { StatusBadge } from '@/components/data-display/status-badge';
import { MessageCircle, Clock } from 'lucide-react';
import { instructorQuestions } from '@/lib/mock-data';

export default function QnAPage() {
  const t = useTranslations('qna');
  const [courseFilter, setCourseFilter] = React.useState('ALL');

  const courses = [...new Set(instructorQuestions.map((q) => q.courseName))];

  const filteredQuestions =
    courseFilter === 'ALL'
      ? instructorQuestions
      : instructorQuestions.filter((q) => q.courseName === courseFilter);

  const renderQuestions = (questions: typeof instructorQuestions) => (
    <div className="space-y-3">
      {questions.map((q) => (
        <Card key={q.id}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AvatarSimple alt={q.studentName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold">{q.studentName}</span>
                  <StatusBadge status={q.status} />
                </div>
                <p className="mb-2 text-sm">{q.question}</p>
                <div className="text-muted-foreground flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs font-normal">
                      {q.courseName}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {q.answerCount} {t('answers')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(q.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {t('reply')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {questions.length === 0 && (
        <p className="text-muted-foreground py-8 text-center">{t('allQuestions')}: 0</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={courseFilter === 'ALL' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setCourseFilter('ALL')}
        >
          {t('allQuestions')}
        </Badge>
        {courses.map((course) => (
          <Badge
            key={course}
            variant={courseFilter === course ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setCourseFilter(course)}
          >
            {course}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            {t('allQuestions')} ({filteredQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="unanswered">
            {t('unanswered')} ({filteredQuestions.filter((q) => q.status === 'UNANSWERED').length})
          </TabsTrigger>
          <TabsTrigger value="answered">
            {t('answered')} ({filteredQuestions.filter((q) => q.status === 'ANSWERED').length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderQuestions(filteredQuestions)}</TabsContent>
        <TabsContent value="unanswered">
          {renderQuestions(filteredQuestions.filter((q) => q.status === 'UNANSWERED'))}
        </TabsContent>
        <TabsContent value="answered">
          {renderQuestions(filteredQuestions.filter((q) => q.status === 'ANSWERED'))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

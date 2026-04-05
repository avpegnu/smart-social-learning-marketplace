'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Send, Code2, Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  Separator,
} from '@shared/ui';
import { useCreateQuestion, useSimilarQuestions, useMyLearning, useDebounce } from '@shared/hooks';

export default function AskQuestionPage() {
  const t = useTranslations('askQuestion');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [courseId, setCourseId] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [code, setCode] = useState('');

  const debouncedTitle = useDebounce(title, 500);
  const { data: similarRaw } = useSimilarQuestions(debouncedTitle);
  const similarData = similarRaw as
    | {
        data?: Array<{
          id: string;
          title: string;
          answerCount: number;
          bestAnswerId?: string | null;
        }>;
      }
    | undefined;
  const similarQuestions = similarData?.data ?? [];

  const { data: learningRaw } = useMyLearning();
  const learningData = learningRaw as
    | { data?: Array<{ course: { id: string; title: string } }> }
    | undefined;
  const enrolledCourses = (learningData?.data ?? []).map((e) => e.course);

  const createQuestion = useCreateQuestion();

  const titleError = title.length > 0 && title.length < 10;
  const contentError = content.length > 0 && content.length < 20;
  const canSubmit = title.length >= 10 && content.length >= 20 && !createQuestion.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    createQuestion.mutate(
      {
        title,
        content,
        courseId: courseId || undefined,
        codeSnippet: showCode && code.trim() ? { language: codeLanguage, code } : undefined,
      },
      {
        onSuccess: (raw) => {
          const result = raw as { data?: { id: string } };
          const newId = result?.data?.id;
          if (newId) {
            router.push(`/qna/${newId}`);
          } else {
            router.push('/qna');
          }
        },
      },
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/qna">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Title */}
        <div className="space-y-2">
          <Label>{t('questionTitle')}</Label>
          <Input
            placeholder={t('titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          {titleError && <p className="text-destructive text-xs">{t('titleMinLength')}</p>}
          <p className="text-muted-foreground text-xs">{title.length}/200</p>
        </div>

        {/* Similar questions */}
        {similarQuestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('similarQuestions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {similarQuestions.map((sq) => (
                <Link
                  key={sq.id}
                  href={`/qna/${sq.id}`}
                  className="hover:text-primary block text-sm transition-colors"
                >
                  {sq.title}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({sq.answerCount} {t('answersCount')})
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Content */}
        <div className="space-y-2">
          <Label>{t('content')}</Label>
          <textarea
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-50 w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder={t('contentPlaceholder')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
          />
          {contentError && <p className="text-destructive text-xs">{t('contentMinLength')}</p>}
          <p className="text-muted-foreground text-xs">{content.length}/5000</p>
        </div>

        {/* Course Select */}
        <div className="space-y-2">
          <Label>{t('relatedCourse')}</Label>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder={t('selectCourse')}
            options={enrolledCourses.map((course) => ({ value: course.id, label: course.title }))}
          />
        </div>

        {/* Code Snippet */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCode(!showCode)}
          >
            <Code2 className="h-4 w-4" />
            {t('addCode')}
          </Button>

          {showCode && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('codeLanguage')}</Label>
                <Select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  options={[
                    'javascript',
                    'typescript',
                    'python',
                    'java',
                    'css',
                    'html',
                    'sql',
                    'bash',
                  ].map((lang) => ({ value: lang, label: lang }))}
                />
              </div>
              <textarea
                className="border-input bg-muted min-h-30 w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm"
                placeholder={t('codePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={5000}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/qna">
            <Button type="button" variant="outline">
              {t('cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={!canSubmit} className="gap-1.5">
            {createQuestion.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}

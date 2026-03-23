'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Code2, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '@shared/ui';
import { useCreateAnswer } from '@shared/hooks';

interface AnswerFormProps {
  questionId: string;
}

export function AnswerForm({ questionId }: AnswerFormProps) {
  const t = useTranslations('questionDetail');
  const [content, setContent] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [code, setCode] = useState('');

  const createAnswer = useCreateAnswer();

  function handleSubmit() {
    if (!content.trim()) return;
    createAnswer.mutate(
      {
        questionId,
        content,
        codeSnippet: showCode && code.trim() ? { language: codeLanguage, code } : undefined,
      },
      {
        onSuccess: () => {
          setContent('');
          setCode('');
          setShowCode(false);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('yourAnswer')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-38 w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          placeholder={t('answerPlaceholder')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex items-center gap-2">
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
        </div>

        {showCode && (
          <div className="space-y-2">
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
            <textarea
              className="border-input bg-muted min-h-30 w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm"
              placeholder={t('codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || createAnswer.isPending}
          className="gap-1.5"
        >
          {createAnswer.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t('submitAnswer')}
        </Button>
      </CardContent>
    </Card>
  );
}

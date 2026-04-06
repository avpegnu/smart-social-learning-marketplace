'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Button, Input, Tabs, TabsList, TabsTrigger } from '@shared/ui';
import { useQuestions, useDebounce } from '@shared/hooks';
import { QuestionCard } from '@/components/qna/question-card';

type TabValue = 'recent' | 'unanswered';

export default function QnaPage() {
  const t = useTranslations('qna');

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabValue>('recent');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 500);

  const params = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: tab === 'unanswered' ? ('unanswered' as const) : ('all' as const),
  };

  const { data: raw, isLoading } = useQuestions(params);
  const result = raw as
    | { data?: unknown[]; meta?: { total: number; totalPages: number } }
    | undefined;
  const questions = (result?.data ?? []) as Array<{
    id: string;
    title: string;
    content: string;
    answerCount: number;
    viewCount: number;
    hasBestAnswer?: boolean;
    bestAnswerId?: string | null;
    createdAt: string;
    author: { id: string; fullName: string; avatarUrl?: string | null };
    course?: { id: string; title: string } | null;
    tag?: { id: string; name: string } | null;
  }>;
  const totalPages = result?.meta?.totalPages ?? 1;

  const handleTabChange = useCallback((value: string) => {
    setTab(value as TabValue);
    setPage(1);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/qna/ask">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t('askQuestion')}
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2" />
        <Input
          placeholder={t('searchPlaceholder')}
          className="h-12 rounded-xl pl-12"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recent" value={tab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="recent">{t('recent')}</TabsTrigger>
          <TabsTrigger value="unanswered">{t('unanswered')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="text-lg">{t('noQuestions')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('prev')}
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

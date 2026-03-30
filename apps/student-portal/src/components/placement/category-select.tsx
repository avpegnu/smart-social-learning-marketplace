'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Target, Info, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Skeleton } from '@shared/ui';
import { useCategories } from '@shared/hooks';
import { cn } from '@/lib/utils';

interface CategorySelectProps {
  onStart: (categoryId?: string) => void;
  isPending: boolean;
}

export function CategorySelect({ onStart, isPending }: CategorySelectProps) {
  const t = useTranslations('placementTest');
  const [selectedId, setSelectedId] = useState('');
  const { data: categoriesData, isLoading } = useCategories();

  const categories =
    (categoriesData?.data as Array<{ id: string; name: string; slug: string }>) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Target className="text-primary h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      {/* Category grid */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="mb-1 font-semibold">{t('selectCategory')}</h2>
          <p className="text-muted-foreground mb-4 text-sm">{t('selectCategoryDesc')}</p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedId(selectedId === cat.id ? '' : cat.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm font-medium transition-colors',
                    selectedId === cat.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:bg-accent/50',
                  )}
                >
                  <span className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold uppercase">
                    {cat.name.charAt(0)}
                  </span>
                  <span className="line-clamp-2">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="bg-muted/50 mb-6 flex items-start gap-2.5 rounded-lg p-3">
        <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-muted-foreground text-sm">{t('testInfo')}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="ghost" onClick={() => onStart(undefined)} disabled={isPending}>
          {t('skipGeneral')}
        </Button>
        <Button
          onClick={() => onStart(selectedId || undefined)}
          disabled={isPending}
          className="gap-2"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? t('starting') : t('startTest')}
        </Button>
      </div>
    </div>
  );
}

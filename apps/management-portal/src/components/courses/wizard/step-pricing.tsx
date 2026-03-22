'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@shared/ui';
import { useUpdateCourse, useUpdateChapter } from '@shared/hooks';
import { formatPrice } from '@shared/utils';
import { toast } from 'sonner';

import type { LocalSection } from './course-wizard';

interface ChapterPricing {
  id: string;
  sectionId: string;
  title: string;
  price: number;
  isFreePreview: boolean;
  originalPrice: number;
  originalFreePreview: boolean;
}

interface StepPricingProps {
  courseId: string;
  course?: Record<string, unknown>;
  sections: LocalSection[];
  onPrevious: () => void;
  onNext: () => void;
  isReadOnly?: boolean;
}

export function StepPricing({
  courseId,
  course,
  sections,
  onPrevious,
  onNext,
  isReadOnly = false,
}: StepPricingProps) {
  const t = useTranslations('courseWizard');
  const updateCourse = useUpdateCourse();
  const updateChapter = useUpdateChapter();

  const [coursePrice, setCoursePrice] = useState(0);
  const [courseOriginalPrice, setCourseOriginalPrice] = useState<number | undefined>(undefined);
  const [isFree, setIsFree] = useState(false);
  const [chapterPricings, setChapterPricings] = useState<ChapterPricing[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize from course data
  useEffect(() => {
    if (course) {
      const price = (course.price as number) ?? 0;
      setCoursePrice(price);
      setIsFree(price === 0);
      setCourseOriginalPrice((course.originalPrice as number) ?? undefined);
    }

    // Build chapter pricings from sections state
    const pricings: ChapterPricing[] = [];
    for (const section of sections) {
      if (section.isDeleted) continue;
      for (const chapter of section.chapters) {
        if (chapter.isDeleted || !chapter.id) continue;
        pricings.push({
          id: chapter.id,
          sectionId: section.id ?? '',
          title: chapter.title,
          price: chapter.price ?? 0,
          isFreePreview: chapter.isFreePreview ?? false,
          originalPrice: chapter.price ?? 0,
          originalFreePreview: chapter.isFreePreview ?? false,
        });
      }
    }
    setChapterPricings(pricings);
  }, [course, sections]);

  const handleFreeToggle = useCallback((checked: boolean) => {
    setIsFree(checked);
    if (checked) setCoursePrice(0);
  }, []);

  const updateChapterPrice = useCallback((chapterId: string, price: number) => {
    setChapterPricings((prev) => prev.map((ch) => (ch.id === chapterId ? { ...ch, price } : ch)));
  }, []);

  const toggleFreePreview = useCallback((chapterId: string) => {
    setChapterPricings((prev) =>
      prev.map((ch) => (ch.id === chapterId ? { ...ch, isFreePreview: !ch.isFreePreview } : ch)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Save course price
      await updateCourse.mutateAsync({
        courseId,
        data: {
          price: isFree ? 0 : coursePrice,
          originalPrice: isFree ? undefined : courseOriginalPrice || undefined,
        },
      });

      // Save changed chapter prices
      const changedChapters = chapterPricings.filter(
        (ch) => ch.price !== ch.originalPrice || ch.isFreePreview !== ch.originalFreePreview,
      );

      for (const ch of changedChapters) {
        await updateChapter.mutateAsync({
          courseId,
          sectionId: ch.sectionId,
          chapterId: ch.id,
          data: { price: ch.price, isFreePreview: ch.isFreePreview },
        });
      }

      toast.success(t('savedSuccess'));
      return true;
    } catch {
      toast.error(t('saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [courseId, coursePrice, isFree, chapterPricings, updateCourse, updateChapter, t]);

  const handleNext = useCallback(async () => {
    const success = await handleSave();
    if (success) onNext();
  }, [handleSave, onNext]);

  return (
    <div className="space-y-6">
      <fieldset disabled={isReadOnly} className={isReadOnly ? 'space-y-6 opacity-70' : 'space-y-6'}>
        {/* Course Price */}
        <div className="border-border space-y-4 rounded-lg border p-6">
          <h3 className="text-lg font-semibold">{t('coursePrice')}</h3>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => handleFreeToggle(e.target.checked)}
                className="border-border h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">{t('freeCourse')}</span>
            </label>
          </div>

          {!isFree && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('priceVnd')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(Number(e.target.value))}
                    min={0}
                    step={1000}
                    className="max-w-xs"
                  />
                  <span className="text-muted-foreground text-sm">
                    = {formatPrice(coursePrice)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('originalPrice')}</Label>
                <p className="text-muted-foreground text-xs">{t('originalPriceDesc')}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={courseOriginalPrice ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCourseOriginalPrice(val ? Number(val) : undefined);
                    }}
                    min={0}
                    step={1000}
                    placeholder={t('originalPricePlaceholder')}
                    className="max-w-xs"
                  />
                  {courseOriginalPrice && courseOriginalPrice > coursePrice && (
                    <span className="text-success text-sm font-medium">
                      -
                      {Math.round(
                        ((courseOriginalPrice - coursePrice) / courseOriginalPrice) * 100,
                      )}
                      %
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chapter Pricing */}
        {chapterPricings.length > 0 && (
          <div className="border-border space-y-4 rounded-lg border p-6">
            <h3 className="text-lg font-semibold">{t('chapterPricing')}</h3>
            <p className="text-muted-foreground text-sm">{t('chapterPricingDesc')}</p>

            <div className="space-y-3">
              {chapterPricings.map((ch) => (
                <div
                  key={ch.id}
                  className="border-border flex items-center gap-4 rounded-md border p-3"
                >
                  <span className="flex-1 text-sm font-medium">{ch.title}</span>

                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={ch.price}
                      onChange={(e) => updateChapterPrice(ch.id, Number(e.target.value))}
                      min={0}
                      step={1000}
                      className="w-32"
                      disabled={isFree}
                    />
                    <span className="text-muted-foreground w-20 text-xs">
                      {formatPrice(ch.price)}
                    </span>
                  </div>

                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={ch.isFreePreview}
                      onChange={() => toggleFreePreview(ch.id)}
                      className="border-border h-4 w-4 rounded"
                    />
                    <span className="text-xs whitespace-nowrap">{t('freePreview')}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {chapterPricings.length === 0 && (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            {t('noChaptersYet')}
          </div>
        )}
      </fieldset>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onPrevious}>
          {t('previous')}
        </Button>
        <div className="flex gap-2">
          {!isReadOnly && (
            <>
              <Button type="button" variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('saveDraft')}
              </Button>
              <Button type="button" onClick={handleNext} disabled={saving}>
                {saving ? t('saving') : t('saveAndNext')}
              </Button>
            </>
          )}
          {isReadOnly && (
            <Button type="button" onClick={onNext}>
              {t('next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

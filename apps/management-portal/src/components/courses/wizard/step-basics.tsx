'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button, Input, Label, Select } from '@shared/ui';
import { useCreateCourse, useUpdateCourse, useCategories } from '@shared/hooks';
import { toast } from 'sonner';

import { courseBasicsSchema } from '@/lib/validations/course';
import type { CourseBasicsValues } from '@/lib/validations/course';
import { RichTextEditor } from '../rich-text-editor';
import { ImageUpload } from '../image-upload';
import { VideoUpload } from '../video-upload';
import { TagSelector } from './tag-selector';

interface StepBasicsProps {
  mode: 'create' | 'edit';
  courseId?: string;
  course?: Record<string, unknown>;
  savedValues: CourseBasicsValues | null;
  onSaveValues: (values: CourseBasicsValues) => void;
  onNext: () => void;
  onCourseCreated: (courseId: string) => void;
  isReadOnly?: boolean;
}

export function StepBasics({
  mode,
  courseId,
  course,
  savedValues,
  onSaveValues,
  onNext,
  onCourseCreated,
  isReadOnly = false,
}: StepBasicsProps) {
  const t = useTranslations('courseWizard');
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const { data: categoriesData } = useCategories();

  // Build default values from saved state or server data
  const defaultValues = buildDefaults(savedValues, course);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CourseBasicsValues>({
    resolver: zodResolver(courseBasicsSchema),
    defaultValues,
  });

  const outcomes = useFieldArray({ control, name: 'learningOutcomes' });
  const prerequisites = useFieldArray({ control, name: 'prerequisites' });

  const description = watch('description');
  const thumbnailUrl = watch('thumbnailUrl');
  const promoVideoUrl = watch('promoVideoUrl');

  // Flatten categories tree for select
  const categories = flattenCategories(
    (categoriesData?.data as Array<Record<string, unknown>>) ?? [],
  );

  const onSubmit = (data: CourseBasicsValues) => {
    onSaveValues(data);

    // Transform field arrays from { value } to plain strings
    const payload: Record<string, unknown> = {
      ...data,
      learningOutcomes: data.learningOutcomes?.map((o) => o.value).filter(Boolean),
      prerequisites: data.prerequisites?.map((p) => p.value).filter(Boolean),
      tagIds: data.tagIds?.length ? data.tagIds : undefined,
      // Remove empty optional strings
      shortDescription: data.shortDescription || undefined,
      description: data.description || undefined,
      thumbnailUrl: data.thumbnailUrl || undefined,
      promoVideoUrl: data.promoVideoUrl || undefined,
    };

    if (mode === 'create' && !courseId) {
      createCourse.mutate(payload, {
        onSuccess: (res) => {
          toast.success(t('savedSuccess'));
          onCourseCreated((res.data as Record<string, unknown>).id as string);
        },
      });
    } else if (courseId) {
      updateCourse.mutate(
        { courseId, data: payload },
        {
          onSuccess: () => {
            toast.success(t('savedSuccess'));
            onNext();
          },
        },
      );
    }
  };

  const isPending = createCourse.isPending || updateCourse.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={isReadOnly} className={isReadOnly ? 'space-y-6 opacity-70' : 'space-y-6'}>
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">{t('title')} *</Label>
          <Input id="title" {...register('title')} placeholder={t('titlePlaceholder')} />
          {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
        </div>

        {/* Short Description */}
        <div className="space-y-2">
          <Label htmlFor="shortDescription">{t('shortDescription')}</Label>
          <Input
            id="shortDescription"
            {...register('shortDescription')}
            placeholder={t('shortDescriptionPlaceholder')}
          />
          {errors.shortDescription && (
            <p className="text-destructive text-sm">{errors.shortDescription.message}</p>
          )}
        </div>

        {/* Description (Tiptap) */}
        <div className="space-y-2">
          <Label>{t('description')}</Label>
          <RichTextEditor
            value={description ?? ''}
            onChange={(html) => setValue('description', html, { shouldValidate: true })}
            placeholder={t('descriptionPlaceholder')}
            readOnly={isReadOnly}
          />
          {errors.description && (
            <p className="text-destructive text-sm">{errors.description.message}</p>
          )}
        </div>

        {/* Category + Level + Language row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="categoryId">{t('category')} *</Label>
            <Select
              id="categoryId"
              name="categoryId"
              value={watch('categoryId')}
              onChange={(e) => setValue('categoryId', e.target.value, { shouldValidate: true })}
              placeholder={t('selectCategory')}
              options={categories.map((cat) => ({
                value: cat.id,
                label: cat.name,
                indent: cat.indent,
              }))}
            />
            {errors.categoryId && (
              <p className="text-destructive text-sm">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">{t('level')} *</Label>
            <Select
              id="level"
              name="level"
              value={watch('level')}
              onChange={(e) =>
                setValue('level', e.target.value as CourseBasicsValues['level'], {
                  shouldValidate: true,
                })
              }
              placeholder={t('selectLevel')}
              options={[
                { value: 'BEGINNER', label: t('beginner') },
                { value: 'INTERMEDIATE', label: t('intermediate') },
                { value: 'ADVANCED', label: t('advanced') },
                { value: 'ALL_LEVELS', label: t('allLevels') },
              ]}
            />
            {errors.level && <p className="text-destructive text-sm">{errors.level.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t('language')} *</Label>
            <Select
              id="language"
              name="language"
              value={watch('language')}
              onChange={(e) => setValue('language', e.target.value, { shouldValidate: true })}
              placeholder={t('selectLanguage')}
              options={[
                { value: 'vi', label: 'Tiếng Việt' },
                { value: 'en', label: 'English' },
              ]}
            />
            {errors.language && (
              <p className="text-destructive text-sm">{errors.language.message}</p>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <div className="space-y-2">
          <Label>{t('thumbnail')}</Label>
          <ImageUpload
            value={thumbnailUrl ?? undefined}
            onChange={(url) => setValue('thumbnailUrl', url)}
            onRemove={() => setValue('thumbnailUrl', '')}
          />
        </div>

        {/* Promo Video */}
        <div className="space-y-2">
          <Label>{t('promoVideo')}</Label>
          <VideoUpload
            value={promoVideoUrl ? { url: promoVideoUrl, duration: 0 } : undefined}
            onChange={(result) => setValue('promoVideoUrl', result.url)}
            onRemove={() => setValue('promoVideoUrl', '')}
          />
        </div>

        {/* Learning Outcomes */}
        <DynamicStringList
          label={t('learningOutcomes')}
          fields={outcomes.fields}
          onAppend={() => outcomes.append({ value: '' })}
          onRemove={outcomes.remove}
          register={register}
          name="learningOutcomes"
          placeholder={t('outcomePlaceholder')}
        />

        {/* Prerequisites */}
        <DynamicStringList
          label={t('prerequisites')}
          fields={prerequisites.fields}
          onAppend={() => prerequisites.append({ value: '' })}
          onRemove={prerequisites.remove}
          register={register}
          name="prerequisites"
          placeholder={t('prerequisitePlaceholder')}
        />

        {/* Tags */}
        <div className="space-y-2">
          <Label>{t('tags')}</Label>
          <TagSelector
            selectedTagIds={watch('tagIds') ?? []}
            onChange={(ids) => setValue('tagIds', ids, { shouldValidate: true })}
            maxTags={10}
          />
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isPending || isReadOnly}>
          {isPending ? t('saving') : courseId ? t('saveAndNext') : t('createAndNext')}
        </Button>
      </div>
    </form>
  );
}

// ── Helpers ──

function buildDefaults(
  saved: CourseBasicsValues | null,
  course?: Record<string, unknown>,
): CourseBasicsValues {
  if (saved) return saved;
  if (course) {
    return {
      title: (course.title as string) ?? '',
      shortDescription: (course.shortDescription as string) ?? '',
      description: (course.description as string) ?? '',
      categoryId: (course.categoryId as string) ?? '',
      level: (course.level as CourseBasicsValues['level']) ?? 'BEGINNER',
      language: (course.language as string) ?? 'vi',
      thumbnailUrl: (course.thumbnailUrl as string) ?? '',
      promoVideoUrl: (course.promoVideoUrl as string) ?? '',
      learningOutcomes: ((course.learningOutcomes as string[]) ?? []).map((v) => ({ value: v })),
      prerequisites: ((course.prerequisites as string[]) ?? []).map((v) => ({ value: v })),
      tagIds: ((course.courseTags as Array<{ tag: { id: string } }>) ?? []).map((ct) => ct.tag.id),
    };
  }
  return {
    title: '',
    shortDescription: '',
    description: '',
    categoryId: '',
    level: 'BEGINNER',
    language: 'vi',
    thumbnailUrl: '',
    promoVideoUrl: '',
    learningOutcomes: [],
    prerequisites: [],
    tagIds: [],
  };
}

interface FlatCategory {
  id: string;
  name: string;
  indent: string;
}

function flattenCategories(categories: Array<Record<string, unknown>>, depth = 0): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    result.push({
      id: cat.id as string,
      name: cat.name as string,
      indent: '\u00A0\u00A0'.repeat(depth),
    });
    if (Array.isArray(cat.children) && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children as Array<Record<string, unknown>>, depth + 1));
    }
  }
  return result;
}

// ── Dynamic String List ──

function DynamicStringList({
  label,
  fields,
  onAppend,
  onRemove,
  register,
  name,
  placeholder,
}: {
  label: string;
  fields: Array<{ id: string }>;
  onAppend: () => void;
  onRemove: (index: number) => void;
  register: ReturnType<typeof useForm<CourseBasicsValues>>['register'];
  name: 'learningOutcomes' | 'prerequisites';
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <Input {...register(`${name}.${index}.value` as const)} placeholder={placeholder} />
            <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAppend}>
        <Plus className="mr-1 h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}

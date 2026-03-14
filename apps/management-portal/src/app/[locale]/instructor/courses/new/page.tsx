'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Progress } from '@shared/ui';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Check, Upload } from 'lucide-react';

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

export default function CreateCoursePage() {
  const t = useTranslations('createCourse');
  const tc = useTranslations('common');
  const [currentStep, setCurrentStep] = React.useState(0);
  const [formData, setFormData] = React.useState({
    title: '',
    subtitle: '',
    description: '',
    category: '',
    level: '',
    language: '',
    price: '',
  });
  const [objectives, setObjectives] = React.useState<string[]>(['']);
  const [prerequisites, setPrerequisites] = React.useState<string[]>(['']);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('courseName')}</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. React & Next.js Masterclass"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('courseSubtitle')}</label>
              <Input
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="e.g. Build modern web applications"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('description')}</label>
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Course description..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('category')}</label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">{t('selectCategory')}</option>
                  <option value="web">Web Development</option>
                  <option value="backend">Backend Development</option>
                  <option value="mobile">Mobile Development</option>
                  <option value="data">Data Science</option>
                  <option value="devops">DevOps</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('level')}</label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <option value="">{t('selectLevel')}</option>
                  <option value="beginner">{t('beginner')}</option>
                  <option value="intermediate">{t('intermediate')}</option>
                  <option value="advanced">{t('advanced')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('language')}</label>
                <select
                  className="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                >
                  <option value="">{t('selectLanguage')}</option>
                  <option value="vi">{t('vietnamese')}</option>
                  <option value="en">{t('english')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('price')} (VND)</label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="599000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('thumbnailUpload')}</label>
                <div className="border-input flex h-10 items-center gap-2 rounded-md border border-dashed px-3">
                  <Upload className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-sm">{t('thumbnailUpload')}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('objectivePlaceholder')}</p>
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                  {i + 1}
                </span>
                <Input
                  value={obj}
                  onChange={(e) => {
                    const updated = [...objectives];
                    updated[i] = e.target.value;
                    setObjectives(updated);
                  }}
                  placeholder={t('objectivePlaceholder')}
                />
                {objectives.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={() => setObjectives([...objectives, ''])}>
              <Plus className="h-4 w-4" />
              {t('addObjective')}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('prerequisitePlaceholder')}</p>
            {prerequisites.map((pre, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="bg-secondary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                  {i + 1}
                </span>
                <Input
                  value={pre}
                  onChange={(e) => {
                    const updated = [...prerequisites];
                    updated[i] = e.target.value;
                    setPrerequisites(updated);
                  }}
                  placeholder={t('prerequisitePlaceholder')}
                />
                {prerequisites.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPrerequisites(prerequisites.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" onClick={() => setPrerequisites([...prerequisites, ''])}>
              <Plus className="h-4 w-4" />
              {t('addPrerequisite')}
            </Button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="font-semibold">{t('reviewTitle')}</h3>
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-muted-foreground text-xs">{t('courseName')}</p>
                <p className="font-medium">{formData.title || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('courseSubtitle')}</p>
                <p className="font-medium">{formData.subtitle || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('category')}</p>
                <p className="font-medium">{formData.category || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('level')}</p>
                <p className="font-medium">{formData.level || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('language')}</p>
                <p className="font-medium">{formData.language || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t('price')}</p>
                <p className="font-medium">
                  {formData.price ? `${Number(formData.price).toLocaleString('vi-VN')} VND` : '-'}
                </p>
              </div>
            </div>
            {objectives.filter(Boolean).length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">{t('step2')}</p>
                <ul className="space-y-1">
                  {objectives.filter(Boolean).map((obj, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="text-success h-4 w-4" />
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {prerequisites.filter(Boolean).length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">{t('step3')}</p>
                <ul className="space-y-1">
                  {prerequisites.filter(Boolean).map((pre, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="text-info h-4 w-4" />
                      {pre}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => (
            <button
              key={step}
              onClick={() => setCurrentStep(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 text-sm font-medium transition-colors',
                i === currentStep
                  ? 'text-primary'
                  : i < currentStep
                    ? 'text-success'
                    : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  i === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : i < currentStep
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden lg:inline">{t(step)}</span>
            </button>
          ))}
        </div>
        <Progress value={progress} />
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle>{t(STEPS[currentStep])}</CardTitle>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          {tc('back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary">{tc('saveDraft')}</Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)}>{tc('next')}</Button>
          ) : (
            <Button>{t('submitForReview')}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

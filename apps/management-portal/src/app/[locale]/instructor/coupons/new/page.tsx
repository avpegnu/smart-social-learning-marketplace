'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Badge,
  Separator,
} from '@shared/ui';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Tag, Percent, DollarSign } from 'lucide-react';
import { instructorCourses } from '@/lib/mock-data';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateCouponPage() {
  const t = useTranslations('createCoupon');
  const _tc = useTranslations('common');

  const [formData, setFormData] = React.useState({
    code: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
    discountValue: '',
    applicableCourses: 'ALL' as 'ALL' | 'SPECIFIC',
    selectedCourses: [] as string[],
    usageLimit: '',
    validFrom: '',
    validTo: '',
    isActive: true,
  });

  const handleGenerateCode = () => {
    setFormData({ ...formData, code: generateCode() });
  };

  const toggleCourse = (courseId: string) => {
    const selected = formData.selectedCourses.includes(courseId)
      ? formData.selectedCourses.filter((id) => id !== courseId)
      : [...formData.selectedCourses, courseId];
    setFormData({ ...formData, selectedCourses: selected });
  };

  const discountDisplay = formData.discountValue
    ? formData.discountType === 'PERCENT'
      ? `${formData.discountValue}%`
      : `${Number(formData.discountValue).toLocaleString('vi-VN')}₫`
    : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/instructor/coupons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('couponInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon Code */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('couponCode')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. SUMMER2025"
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={handleGenerateCode} type="button">
                    <RefreshCw className="h-4 w-4" />
                    {t('autoGenerate')}
                  </Button>
                </div>
              </div>

              {/* Discount Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('discountType')}</label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      checked={formData.discountType === 'PERCENT'}
                      onChange={() => setFormData({ ...formData, discountType: 'PERCENT' })}
                      className="h-4 w-4"
                    />
                    <Percent className="text-muted-foreground h-4 w-4" />
                    <span className="text-sm">{t('percentage')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      checked={formData.discountType === 'FIXED'}
                      onChange={() => setFormData({ ...formData, discountType: 'FIXED' })}
                      className="h-4 w-4"
                    />
                    <DollarSign className="text-muted-foreground h-4 w-4" />
                    <span className="text-sm">{t('fixedAmount')}</span>
                  </label>
                </div>
              </div>

              {/* Discount Value */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('discountValue')}</label>
                <Input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  placeholder={formData.discountType === 'PERCENT' ? 'e.g. 20' : 'e.g. 50000'}
                />
              </div>

              <Separator />

              {/* Applicable Courses */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('applicableCourses')}</label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="applicableCourses"
                      checked={formData.applicableCourses === 'ALL'}
                      onChange={() =>
                        setFormData({ ...formData, applicableCourses: 'ALL', selectedCourses: [] })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{t('allCourses')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="applicableCourses"
                      checked={formData.applicableCourses === 'SPECIFIC'}
                      onChange={() => setFormData({ ...formData, applicableCourses: 'SPECIFIC' })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{t('specificCourses')}</span>
                  </label>
                </div>
                {formData.applicableCourses === 'SPECIFIC' && (
                  <div className="mt-2 space-y-2 rounded-md border p-3">
                    {instructorCourses
                      .filter((c) => c.status === 'PUBLISHED')
                      .map((course) => (
                        <label key={course.id} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.selectedCourses.includes(course.id)}
                            onChange={() => toggleCourse(course.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{course.title}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Usage Limit */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('usageLimit')}</label>
                <Input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  placeholder="e.g. 100"
                />
              </div>

              {/* Valid Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('validFrom')}</label>
                  <Input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('validTo')}</label>
                  <Input
                    type="date"
                    value={formData.validTo}
                    onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{t('activateImmediately')}</p>
                  <p className="text-muted-foreground text-xs">{t('activateDescription')}</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
                    formData.isActive ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      formData.isActive ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full">
            <Tag className="h-4 w-4" />
            {t('title')}
          </Button>
        </div>

        {/* Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-primary/30 bg-primary/5 rounded-lg border-2 border-dashed p-4 text-center">
                <Tag className="text-primary mx-auto mb-2 h-8 w-8" />
                <p className="text-primary font-mono text-lg font-bold">
                  {formData.code || 'CODE'}
                </p>
                <p className="mt-1 text-2xl font-bold">{discountDisplay}</p>
                <p className="text-muted-foreground text-xs">
                  {formData.discountType === 'PERCENT' ? t('percentOff') : t('fixedOff')}
                </p>
                <Separator className="my-3" />
                <div className="text-muted-foreground space-y-1 text-xs">
                  {formData.usageLimit && (
                    <p>
                      {t('limitLabel')}: {formData.usageLimit} {t('uses')}
                    </p>
                  )}
                  {formData.validFrom && formData.validTo && (
                    <p>
                      {formData.validFrom} - {formData.validTo}
                    </p>
                  )}
                  <p>
                    {formData.applicableCourses === 'ALL'
                      ? t('allCourses')
                      : `${formData.selectedCourses.length} ${t('coursesSelected')}`}
                  </p>
                </div>
                <Badge className="mt-3" variant={formData.isActive ? 'default' : 'secondary'}>
                  {formData.isActive ? t('active') : t('inactive')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Separator,
  Label,
} from '@shared/ui';
import { ArrowLeft, RefreshCw, Tag, Percent, DollarSign } from 'lucide-react';
import { useInstructorCourses, useCreateCoupon } from '@shared/hooks';
import { formatPrice } from '@shared/utils';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}

interface InstructorCourse {
  id: string;
  title: string;
  status: string;
}

export default function CreateCouponPage() {
  const t = useTranslations('couponForm');
  const router = useRouter();
  const createCoupon = useCreateCoupon();

  const { data: coursesData } = useInstructorCourses({ limit: 100 });
  const courses = ((coursesData?.data ?? []) as InstructorCourse[]).filter(
    (c) => c.status === 'PUBLISHED',
  );

  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [courseMode, setCourseMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const discountDisplay = value
    ? type === 'PERCENTAGE'
      ? `${value}%`
      : formatPrice(Number(value))
    : '—';

  const isValid =
    code.length >= 4 &&
    Number(value) > 0 &&
    (type !== 'PERCENTAGE' || (Number(value) >= 1 && Number(value) <= 100)) &&
    startsAt &&
    expiresAt &&
    new Date(startsAt) < new Date(expiresAt);

  const handleSubmit = () => {
    if (!isValid) return;

    createCoupon.mutate(
      {
        code,
        type,
        value: Number(value),
        ...(usageLimit && { usageLimit: Number(usageLimit) }),
        ...(maxUsesPerUser && { maxUsesPerUser: Number(maxUsesPerUser) }),
        ...(minOrderAmount && { minOrderAmount: Number(minOrderAmount) }),
        ...(type === 'PERCENTAGE' && maxDiscount && { maxDiscount: Number(maxDiscount) }),
        ...(courseMode === 'SPECIFIC' &&
          selectedCourses.length > 0 && { applicableCourseIds: selectedCourses }),
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success(t('couponCreated'));
          router.push('/instructor/coupons');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/instructor/coupons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t('createTitle')}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('code')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon Code */}
              <div className="space-y-2">
                <Label>{t('code')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t('codePlaceholder')}
                    className="font-mono"
                  />
                  <Button variant="outline" onClick={() => setCode(generateCode())} type="button">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('generateCode')}
                  </Button>
                </div>
              </div>

              {/* Discount Type */}
              <div className="space-y-2">
                <Label>{t('discountType')}</Label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={type === 'PERCENTAGE'}
                      onChange={() => setType('PERCENTAGE')}
                      className="h-4 w-4"
                    />
                    <Percent className="text-muted-foreground h-4 w-4" />
                    <span className="text-sm">{t('percentage')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={type === 'FIXED_AMOUNT'}
                      onChange={() => setType('FIXED_AMOUNT')}
                      className="h-4 w-4"
                    />
                    <DollarSign className="text-muted-foreground h-4 w-4" />
                    <span className="text-sm">{t('fixedAmount')}</span>
                  </label>
                </div>
              </div>

              {/* Discount Value */}
              <div className="space-y-2">
                <Label>{t('discountValue')}</Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === 'PERCENTAGE' ? '1-100' : '50000'}
                  min={type === 'PERCENTAGE' ? 1 : 0}
                  max={type === 'PERCENTAGE' ? 100 : undefined}
                />
              </div>

              {/* Max Discount (for PERCENTAGE only) */}
              {type === 'PERCENTAGE' && (
                <div className="space-y-2">
                  <Label>{t('maxDiscount')}</Label>
                  <Input
                    type="number"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    placeholder={t('maxDiscountHelp')}
                  />
                </div>
              )}

              <Separator />

              {/* Applicable Courses */}
              <div className="space-y-2">
                <Label>{t('applicableCourses')}</Label>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={courseMode === 'ALL'}
                      onChange={() => {
                        setCourseMode('ALL');
                        setSelectedCourses([]);
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{t('allCourses')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={courseMode === 'SPECIFIC'}
                      onChange={() => setCourseMode('SPECIFIC')}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{t('specificCourses')}</span>
                  </label>
                </div>
                {courseMode === 'SPECIFIC' && (
                  <div className="mt-2 space-y-2 rounded-md border p-3">
                    {courses.map((course) => (
                      <label key={course.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.id)}
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

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('usageLimit')}</Label>
                  <Input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder={t('usageLimitPlaceholder')}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('maxUsesPerUser')}</Label>
                  <Input
                    type="number"
                    value={maxUsesPerUser}
                    onChange={(e) => setMaxUsesPerUser(e.target.value)}
                    min={1}
                  />
                </div>
              </div>

              {/* Min Order Amount */}
              <div className="space-y-2">
                <Label>{t('minOrderAmount')}</Label>
                <Input
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>

              {/* Valid Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('startDate')}</Label>
                  <Input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('endDate')}</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!isValid || createCoupon.isPending}
          >
            <Tag className="mr-2 h-4 w-4" />
            {createCoupon.isPending ? t('create') + '...' : t('create')}
          </Button>
        </div>

        {/* Preview */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">{t('preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-primary/30 bg-primary/5 rounded-lg border-2 border-dashed p-4 text-center">
                <Tag className="text-primary mx-auto mb-2 h-8 w-8" />
                <p className="text-primary font-mono text-lg font-bold">{code || 'CODE'}</p>
                <p className="mt-1 text-2xl font-bold">{discountDisplay}</p>
                <p className="text-muted-foreground text-xs">
                  {type === 'PERCENTAGE' ? t('percentage') : t('fixedAmount')}
                </p>
                <Separator className="my-3" />
                <div className="text-muted-foreground space-y-1 text-xs">
                  {usageLimit && (
                    <p>
                      {t('usageLimit')}: {usageLimit}
                    </p>
                  )}
                  {startsAt && expiresAt && (
                    <p>
                      {startsAt} — {expiresAt}
                    </p>
                  )}
                  <p>
                    {courseMode === 'ALL' ? t('allCourses') : `${selectedCourses.length} courses`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

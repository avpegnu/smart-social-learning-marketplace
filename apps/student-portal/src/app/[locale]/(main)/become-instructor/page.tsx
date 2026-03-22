'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import {
  GraduationCap,
  DollarSign,
  Users,
  Heart,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import { useApplyInstructor, useMyApplications, useAuthStore } from '@shared/hooks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@shared/utils';

interface ApplicationValues {
  expertise: string;
  experience: string;
  motivation: string;
  cvUrl: string;
  certificateUrls: string;
}

export default function BecomeInstructorPage() {
  const t = useTranslations('becomeInstructor');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: appsRaw } = useMyApplications(isAuthenticated);
  const applications =
    (
      appsRaw as {
        data?: Array<{
          id: string;
          status: string;
          reviewNote?: string;
          expertise: string[];
          experience?: string;
          motivation?: string;
          createdAt: string;
        }>;
      }
    )?.data ?? [];
  const latestApp = applications[0];

  const applyMutation = useApplyInstructor();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationValues>();

  const onSubmit = (data: ApplicationValues) => {
    const expertise = data.expertise
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (expertise.length === 0) {
      toast.error(t('expertiseRequired'));
      return;
    }
    const certUrls = data.certificateUrls
      ? data.certificateUrls
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    applyMutation.mutate(
      {
        expertise,
        experience: data.experience || undefined,
        motivation: data.motivation || undefined,
        cvUrl: data.cvUrl || undefined,
        certificateUrls: certUrls?.length ? certUrls : undefined,
      },
      {
        onSuccess: () => toast.success(t('applicationSubmitted')),
      },
    );
  };

  const benefits = [
    {
      icon: DollarSign,
      title: t('benefit1Title'),
      desc: t('benefit1Desc'),
      color: 'text-green-500 bg-green-500/10',
    },
    {
      icon: Users,
      title: t('benefit2Title'),
      desc: t('benefit2Desc'),
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      icon: GraduationCap,
      title: t('benefit3Title'),
      desc: t('benefit3Desc'),
      color: 'text-violet-500 bg-violet-500/10',
    },
    {
      icon: Heart,
      title: t('benefit4Title'),
      desc: t('benefit4Desc'),
      color: 'text-red-500 bg-red-500/10',
    },
  ];

  // Already instructor
  if (user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold">{t('alreadyInstructor')}</h1>
        <p className="text-muted-foreground mt-2">{t('alreadyInstructorDesc')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <GraduationCap className="text-primary h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{t('subtitle')}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Benefits */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">{t('whyTeach')}</h2>
          <div className="space-y-4">
            {benefits.map((b) => (
              <div key={b.title} className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    b.color,
                  )}
                >
                  <b.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{b.title}</h3>
                  <p className="text-muted-foreground text-sm">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Application Form or Status */}
        <div>
          {latestApp?.status === 'PENDING' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  {t('applicationPending')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{t('applicationPendingDesc')}</p>
                <div className="mt-4 space-y-3 overflow-hidden rounded-lg bg-yellow-500/10 p-4 wrap-break-word">
                  <div>
                    <p className="text-xs font-medium text-yellow-700">{t('expertise')}</p>
                    <p className="text-sm">{latestApp.expertise.join(', ')}</p>
                  </div>
                  {latestApp.experience && (
                    <div>
                      <p className="text-xs font-medium text-yellow-700">{t('experience')}</p>
                      <p className="text-sm">{latestApp.experience}</p>
                    </div>
                  )}
                  {latestApp.motivation && (
                    <div>
                      <p className="text-xs font-medium text-yellow-700">{t('motivation')}</p>
                      <p className="text-sm">{latestApp.motivation}</p>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {t('submittedAt')} {formatRelativeTime(latestApp.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : latestApp?.status === 'REJECTED' ? (
            <div className="space-y-4">
              <Card className="border-destructive/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{t('applicationRejected')}</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {latestApp.reviewNote || t('noFeedback')}
                      </p>
                      <div className="text-muted-foreground mt-3 space-y-1 text-xs">
                        <p>
                          {t('expertise')}: {latestApp.expertise.join(', ')}
                        </p>
                        <p>
                          {t('submittedAt')} {formatRelativeTime(latestApp.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-muted-foreground text-sm">{t('reapplyHint')}</p>
              <ApplicationForm
                register={register}
                errors={errors}
                handleSubmit={handleSubmit}
                onSubmit={onSubmit}
                isPending={applyMutation.isPending}
                t={t}
              />
            </div>
          ) : (
            <ApplicationForm
              register={register}
              errors={errors}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              isPending={applyMutation.isPending}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ApplicationForm({
  register,
  errors,
  handleSubmit,
  onSubmit,
  isPending,
  t,
}: {
  register: ReturnType<typeof useForm<ApplicationValues>>['register'];
  errors: ReturnType<typeof useForm<ApplicationValues>>['formState']['errors'];
  handleSubmit: ReturnType<typeof useForm<ApplicationValues>>['handleSubmit'];
  onSubmit: (data: ApplicationValues) => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('applicationForm')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('expertise')}</label>
            <Input
              {...register('expertise', { required: true })}
              placeholder={t('expertisePlaceholder')}
            />
            {errors.expertise && (
              <p className="text-destructive text-xs">{t('expertiseRequired')}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('experience')}</label>
            <textarea
              {...register('experience', { minLength: 50 })}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={4}
              placeholder={t('experiencePlaceholder')}
            />
            {errors.experience && (
              <p className="text-destructive text-xs">{t('experienceMinLength')}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('motivation')}</label>
            <textarea
              {...register('motivation')}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
              placeholder={t('motivationPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('cvUrl')}</label>
            <Input {...register('cvUrl')} placeholder={t('cvUrlPlaceholder')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('certificateUrls')}</label>
            <textarea
              {...register('certificateUrls')}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={2}
              placeholder={t('certificateUrlsPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">{t('certificateUrlsHint')}</p>
          </div>
          <Button type="submit" className="w-full gap-2" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('submitApplication')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

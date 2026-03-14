'use client';

import { useTranslations } from 'next-intl';
import { GraduationCap, DollarSign, Users, Heart, Wrench, Send } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import { cn } from '@/lib/utils';

export default function BecomeInstructorPage() {
  const t = useTranslations('becomeInstructor');

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
      icon: Heart,
      title: t('benefit3Title'),
      desc: t('benefit3Desc'),
      color: 'text-pink-500 bg-pink-500/10',
    },
    {
      icon: Wrench,
      title: t('benefit4Title'),
      desc: t('benefit4Desc'),
      color: 'text-blue-500 bg-blue-500/10',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <GraduationCap className="text-primary h-10 w-10" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Benefits */}
        <div>
          <h2 className="mb-6 text-xl font-bold">{t('whyTeach')}</h2>
          <div className="space-y-4">
            {benefits.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                    color,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{title}</h3>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('applicationForm')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('expertise')}</label>
                <Input placeholder={t('expertisePlaceholder')} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('experience')}</label>
                <textarea
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder={t('experiencePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('motivation')}</label>
                <textarea
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  placeholder={t('motivationPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('sampleLesson')}</label>
                <Input placeholder={t('sampleLessonPlaceholder')} />
              </div>

              <Button type="submit" className="w-full gap-1.5" size="lg">
                <Send className="h-4 w-4" />
                {t('submitApplication')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

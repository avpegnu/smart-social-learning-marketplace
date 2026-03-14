'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { cn } from '@/lib/utils';
import { Save } from 'lucide-react';
import { systemSettings } from '@/lib/mock-data';

export default function AdminSettingsPage() {
  const t = useTranslations('adminSettings');
  const tc = useTranslations('common');

  const [general, setGeneral] = React.useState(systemSettings.general);
  const [commission, setCommission] = React.useState(systemSettings.commission);
  const [content, setContent] = React.useState(systemSettings.content);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('general')}</TabsTrigger>
          <TabsTrigger value="commission">{t('commission')}</TabsTrigger>
          <TabsTrigger value="email">{t('email')}</TabsTrigger>
          <TabsTrigger value="content">{t('content')}</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('generalSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('platformName')}</label>
                <Input
                  value={general.platformName}
                  onChange={(e) => setGeneral({ ...general, platformName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('platformDescription')}</label>
                <textarea
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={general.platformDescription}
                  onChange={(e) => setGeneral({ ...general, platformDescription: e.target.value })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{t('maintenanceMode')}</p>
                  <p className="text-muted-foreground text-xs">{t('maintenanceModeDesc')}</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
                    general.maintenanceMode ? 'bg-destructive' : 'bg-muted',
                  )}
                  onClick={() =>
                    setGeneral({ ...general, maintenanceMode: !general.maintenanceMode })
                  }
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      general.maintenanceMode ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>
              <div className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4" />
                  {tc('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Settings */}
        <TabsContent value="commission" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('commissionSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('commissionRate')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={commission.commissionRate}
                    onChange={(e) =>
                      setCommission({ ...commission, commissionRate: Number(e.target.value) })
                    }
                    className="max-w-[120px]"
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-muted-foreground text-xs">{t('commissionRateDesc')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('minimumWithdrawal')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={commission.minimumWithdrawal}
                    onChange={(e) =>
                      setCommission({ ...commission, minimumWithdrawal: Number(e.target.value) })
                    }
                    className="max-w-[200px]"
                  />
                  <span className="text-muted-foreground text-sm">VND</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4" />
                  {tc('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('emailSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('smtpHost')}</label>
                <Input value={systemSettings.email.smtpHost} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('smtpPort')}</label>
                <Input
                  value={String(systemSettings.email.smtpPort)}
                  disabled
                  className="max-w-[120px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('smtpUser')}</label>
                <Input value={systemSettings.email.smtpUser} disabled />
              </div>
              <p className="text-muted-foreground text-xs">{t('emailSettingsNote')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Settings */}
        <TabsContent value="content" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('contentSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{t('autoApproveCourses')}</p>
                  <p className="text-muted-foreground text-xs">{t('autoApproveCoursesDesc')}</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors',
                    content.autoApproveCourses ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() =>
                    setContent({ ...content, autoApproveCourses: !content.autoApproveCourses })
                  }
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      content.autoApproveCourses ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('maxUploadSize')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={content.maxUploadSize}
                    onChange={(e) =>
                      setContent({ ...content, maxUploadSize: Number(e.target.value) })
                    }
                    className="max-w-[120px]"
                  />
                  <span className="text-muted-foreground text-sm">MB</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4" />
                  {tc('save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

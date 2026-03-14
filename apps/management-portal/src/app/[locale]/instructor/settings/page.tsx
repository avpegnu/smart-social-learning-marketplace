'use client';

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
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@shared/ui';

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('profile')}</TabsTrigger>
          <TabsTrigger value="payout">{t('payout')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('notifications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('fullName')}</label>
                  <Input defaultValue="Nguyen Van An" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue="an.nguyen@email.com" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('phone')}</label>
                <Input defaultValue="0912345678" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('bio')}</label>
                <textarea
                  className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  defaultValue="Senior Software Engineer voi 10 nam kinh nghiem. Dam me chia se kien thuc lap trinh."
                />
              </div>
              <Button>{t('saveChanges')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payout')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('bankName')}</label>
                  <Input defaultValue="Vietcombank" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('accountNumber')}</label>
                  <Input defaultValue="1234567890" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('accountHolder')}</label>
                <Input defaultValue="NGUYEN VAN AN" />
              </div>
              <Button>{t('saveChanges')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('emailNotifications')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'newEnrollment', default: true },
                { key: 'newReview', default: true },
                { key: 'newQuestion', default: true },
                { key: 'withdrawalUpdate', default: false },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {t(
                      item.key as
                        | 'newEnrollment'
                        | 'newReview'
                        | 'newQuestion'
                        | 'withdrawalUpdate',
                    )}
                  </label>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" defaultChecked={item.default} className="peer sr-only" />
                    <div className="peer bg-muted peer-checked:bg-primary h-6 w-11 rounded-full after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>
              ))}
              <Separator />
              <Button>{t('saveChanges')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { User, Shield, Bell, Palette, Camera, Sun, Moon, Monitor, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Separator,
  Avatar,
  AvatarFallback,
} from '@shared/ui';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const tabs = [
  { key: 'profile', icon: User },
  { key: 'account', icon: Shield },
  { key: 'notifications', icon: Bell },
  { key: 'appearance', icon: Palette },
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<string>('profile');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar tabs - Vertical on desktop, horizontal on mobile */}
        <nav className="shrink-0 md:w-56">
          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {tabs.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`tab_${key}`)}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tab_profile')}</CardTitle>
                <CardDescription>{t('profileDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        MT
                      </AvatarFallback>
                    </Avatar>
                    <button className="bg-primary text-primary-foreground absolute right-0 bottom-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('changeAvatar')}</p>
                    <p className="text-muted-foreground text-xs">{t('avatarHint')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('fullName')}</label>
                    <Input defaultValue="Nguyễn Minh Tuấn" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input defaultValue="minhtuan@email.com" disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('phone')}</label>
                    <Input defaultValue="0912 345 678" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('website')}</label>
                    <Input placeholder="https://" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('bio')}</label>
                  <textarea
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    placeholder={t('bioPlaceholder')}
                    defaultValue="Frontend developer. Yeu thich React va Next.js."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('socialLinks')}</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input placeholder="GitHub" defaultValue="github.com/minhtuan" />
                    <Input placeholder="LinkedIn" />
                    <Input placeholder="Twitter/X" />
                    <Input placeholder="Facebook" />
                  </div>
                </div>

                <Button>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('changePassword')}</CardTitle>
                  <CardDescription>{t('changePasswordDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('currentPassword')}</label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('newPassword')}</label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('confirmNewPassword')}</label>
                    <Input type="password" />
                  </div>
                  <Button>{t('updatePassword')}</Button>
                </CardContent>
              </Card>

              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">{t('deleteAccount')}</CardTitle>
                  <CardDescription>{t('deleteAccountDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    {t('deleteAccountButton')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tab_notifications')}</CardTitle>
                <CardDescription>{t('notificationsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  'courseUpdates',
                  'newMessages',
                  'socialActivity',
                  'promotions',
                  'reminders',
                  'weeklyDigest',
                ].map((key) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{t(`notif_${key}`)}</p>
                      <p className="text-muted-foreground text-xs">{t(`notif_${key}_desc`)}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        defaultChecked={key !== 'promotions'}
                        className="peer sr-only"
                      />
                      <div className="bg-muted peer peer-checked:bg-primary h-6 w-11 rounded-full peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tab_appearance')}</CardTitle>
                <CardDescription>{t('appearanceDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-medium">{t('theme')}</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', icon: Sun, label: t('themeLight') },
                      { value: 'dark', icon: Moon, label: t('themeDark') },
                      { value: 'system', icon: Monitor, label: t('themeSystem') },
                    ].map(({ value, icon: Icon, label }) => (
                      <label
                        key={value}
                        className="border-border hover:border-primary flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors"
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={value}
                          defaultChecked={value === 'system'}
                          className="sr-only"
                        />
                        <Icon className="h-6 w-6" />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 text-sm font-medium">{t('language')}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
                      { value: 'en', label: 'English', flag: '🇺🇸' },
                    ].map(({ value, label, flag }) => (
                      <label
                        key={value}
                        className="border-border hover:border-primary flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors"
                      >
                        <input
                          type="radio"
                          name="language"
                          value={value}
                          defaultChecked={value === 'vi'}
                          className="sr-only"
                        />
                        <span className="text-2xl">{flag}</span>
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

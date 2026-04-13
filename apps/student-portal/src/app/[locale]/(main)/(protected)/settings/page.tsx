'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Shield, Bell, Palette, Sun, Moon, Monitor, Loader2, Lock } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@shared/ui';
import { useChangePassword, useMe, useUpdateNotificationPreferences } from '@shared/hooks';
import { useRouter, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SettingsTab = 'account' | 'notifications' | 'appearance';

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'account', label: t('tab_account'), icon: <Shield className="h-4 w-4" /> },
    { key: 'notifications', label: t('tab_notifications'), icon: <Bell className="h-4 w-4" /> },
    { key: 'appearance', label: t('tab_appearance'), icon: <Palette className="h-4 w-4" /> },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <nav className="flex gap-1 overflow-x-auto lg:w-48 lg:flex-col">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

// ── Account Tab ──

function AccountTab() {
  const t = useTranslations('settings');
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>();

  const onSubmit = (data: PasswordValues) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          toast.success(t('passwordChanged'));
          reset();
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('changePassword')}
          </CardTitle>
          <CardDescription>{t('changePasswordDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('currentPassword')}</label>
              <Input
                type="password"
                {...register('currentPassword', { required: true })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('newPassword')}</label>
              <Input
                type="password"
                {...register('newPassword', { required: true, minLength: 8 })}
                placeholder="••••••••"
              />
              {errors.newPassword && (
                <p className="text-destructive text-xs">{t('passwordMinLength')}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('confirmNewPassword')}</label>
              <Input
                type="password"
                {...register('confirmPassword', { required: true })}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('updatePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Notifications Tab ──

function NotificationsTab() {
  const t = useTranslations('settings');
  const { data: meRaw } = useMe();
  const me = (
    meRaw as {
      data?: { notificationPreferences?: Record<string, { inApp: boolean }> };
    }
  )?.data;
  const updatePrefs = useUpdateNotificationPreferences();

  const prefs = me?.notificationPreferences ?? {};

  const notifTypes = [
    { key: 'socialUpdates', label: t('notif_socialUpdates'), desc: t('notif_socialUpdates_desc') },
    { key: 'newFollowers', label: t('notif_newFollowers'), desc: t('notif_newFollowers_desc') },
    { key: 'orderUpdates', label: t('notif_orderUpdates'), desc: t('notif_orderUpdates_desc') },
    {
      key: 'reviewResponses',
      label: t('notif_reviewResponses'),
      desc: t('notif_reviewResponses_desc'),
    },
    { key: 'systemAnnouncements', label: t('notif_system'), desc: t('notif_system_desc') },
  ];

  const handleToggle = (key: string) => {
    const current = prefs[key] ?? { inApp: true };
    const updated = { ...prefs, [key]: { inApp: !current.inApp } };
    updatePrefs.mutate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tab_notifications')}</CardTitle>
        <CardDescription>{t('notificationsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifTypes.map((item) => {
            const pref = prefs[item.key] ?? { inApp: true };
            return (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={pref.inApp}
                    onChange={() => handleToggle(item.key)}
                    className="accent-primary h-4 w-4 rounded"
                  />
                  In-app
                </label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Appearance Tab ──

function AppearanceTab() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const themes = [
    { key: 'light', label: t('themeLight'), icon: <Sun className="h-5 w-5" /> },
    { key: 'dark', label: t('themeDark'), icon: <Moon className="h-5 w-5" /> },
    { key: 'system', label: t('themeSystem'), icon: <Monitor className="h-5 w-5" /> },
  ];

  const languages = [
    { key: 'vi', label: 'Tiếng Việt' },
    { key: 'en', label: 'English' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('theme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t_item) => (
              <button
                key={t_item.key}
                onClick={() => setTheme(t_item.key)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  theme === t_item.key
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-border border-transparent',
                )}
              >
                {t_item.icon}
                <span className="text-sm font-medium">{t_item.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {languages.map((lang) => {
              const currentLocale = locale;
              return (
                <button
                  key={lang.key}
                  onClick={() => router.replace(pathname, { locale: lang.key })}
                  className={cn(
                    'rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors',
                    currentLocale === lang.key
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-border border-transparent',
                  )}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

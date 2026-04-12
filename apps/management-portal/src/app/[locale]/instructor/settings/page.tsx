'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Label,
  Skeleton,
} from '@shared/ui';
import {
  useInstructorProfile,
  useUpdateInstructorProfile,
  useAuthStore,
  useInstructorDashboard,
  useMe,
  useUpdateNotificationPreferences,
} from '@shared/hooks';
import { formatPrice } from '@shared/utils';

interface InstructorProfile {
  headline: string | null;
  biography: string | null;
  expertise: string[];
  experience: string | null;
  socialLinks: Record<string, string> | null;
  user: { fullName: string; email: string; avatarUrl: string | null };
}

interface DashboardOverview {
  totalRevenue: number;
  availableBalance: number;
  pendingBalance: number;
}

const NOTIFICATION_TYPES = [
  'newEnrollment',
  'newReview',
  'courseApproval',
  'payoutCompleted',
  'weeklyReport',
] as const;

export default function SettingsPage() {
  const t = useTranslations('settings');
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useInstructorProfile();
  const { data: dashboardData } = useInstructorDashboard();
  const updateProfile = useUpdateInstructorProfile();

  const profile = data?.data as InstructorProfile | undefined;
  const overview = (dashboardData?.data as { overview?: DashboardOverview } | undefined)?.overview;

  const [headline, setHeadline] = useState('');
  const [biography, setBiography] = useState('');
  const [expertiseInput, setExpertiseInput] = useState('');
  const [expertise, setExpertise] = useState<string[]>([]);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setHeadline(profile.headline ?? '');
      setBiography(profile.biography ?? '');
      setExpertise(profile.expertise ?? []);
    }
  }, [profile]);

  const handleAddExpertise = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && expertiseInput.trim()) {
      e.preventDefault();
      if (!expertise.includes(expertiseInput.trim())) {
        setExpertise([...expertise, expertiseInput.trim()]);
      }
      setExpertiseInput('');
    }
  };

  const removeExpertise = (item: string) => {
    setExpertise(expertise.filter((e) => e !== item));
  };

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { headline, biography, expertise },
      {
        onSuccess: () => toast.success(t('profileSaved')),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('profile')}</TabsTrigger>
          <TabsTrigger value="payout">{t('payout')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('notifications')}</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('fullName')}</Label>
                  <Input value={profile?.user.fullName ?? user?.fullName ?? ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile?.user.email ?? user?.email ?? ''} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('headline')}</Label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder={t('headlinePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('biography')}</Label>
                <Textarea
                  value={biography}
                  onChange={(e) => setBiography(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('expertise')}</Label>
                <Input
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={handleAddExpertise}
                  placeholder={t('expertisePlaceholder')}
                />
                {expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {expertise.map((item) => (
                      <span
                        key={item}
                        className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeExpertise(item)}
                          className="hover:text-destructive ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                {t('saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payout Tab */}
        <TabsContent value="payout">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payout')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-muted-foreground text-xs">{t('totalRevenue')}</p>
                  <p className="mt-1 text-xl font-bold">
                    {formatPrice(overview?.totalRevenue ?? 0)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-muted-foreground text-xs">{t('availableBalance')}</p>
                  <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-500">
                    {formatPrice(overview?.availableBalance ?? 0)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-muted-foreground text-xs">{t('pendingBalance')}</p>
                  <p className="mt-1 text-xl font-bold text-yellow-600 dark:text-yellow-500">
                    {formatPrice(overview?.pendingBalance ?? 0)}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground text-sm">{t('balanceDesc')}</p>
              <p className="text-muted-foreground text-sm">{t('payoutInfo')}</p>

              <Link href="/instructor/withdrawals">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t('goToWithdrawals')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Notifications Tab ──

function NotificationsTab() {
  const t = useTranslations('settings');
  const { data: meRaw } = useMe();
  const me = (
    meRaw as {
      data?: { notificationPreferences?: Record<string, { inApp: boolean; email: boolean }> };
    }
  )?.data;
  const updatePrefs = useUpdateNotificationPreferences();

  const prefs = me?.notificationPreferences ?? {};

  const handleToggle = (key: string, field: 'inApp' | 'email') => {
    const current = prefs[key] ?? { inApp: true, email: false };
    const updated = { ...prefs, [key]: { ...current, [field]: !current[field] } };
    updatePrefs.mutate(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('emailNotifications')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{t('notificationsDesc')}</p>
        <div className="space-y-2">
          {NOTIFICATION_TYPES.map((key) => {
            const pref = prefs[key] ?? { inApp: true, email: false };
            return (
              <div
                key={key}
                className="border-border flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm">{t(`notif_${key}`)}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={pref.inApp}
                      onChange={() => handleToggle(key, 'inApp')}
                      className="accent-primary h-4 w-4 rounded"
                    />
                    In-app
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={pref.email}
                      onChange={() => handleToggle(key, 'email')}
                      className="accent-primary h-4 w-4 rounded"
                    />
                    Email
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

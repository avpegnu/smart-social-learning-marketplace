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
import { useInstructorProfile, useUpdateInstructorProfile, useAuthStore } from '@shared/hooks';

interface InstructorProfile {
  headline: string | null;
  biography: string | null;
  expertise: string[];
  experience: string | null;
  socialLinks: Record<string, string> | null;
  user: { fullName: string; email: string; avatarUrl: string | null };
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useInstructorProfile();
  const updateProfile = useUpdateInstructorProfile();

  const profile = data?.data as InstructorProfile | undefined;

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
            <CardContent className="space-y-4">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('emailNotifications')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{t('notificationsComingSoon')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  UserPlus,
  UserMinus,
  Pencil,
  Award,
  Loader2,
  GraduationCap,
  MessageCircle,
} from 'lucide-react';
import { Button, Card, CardContent, Avatar, AvatarFallback, AvatarImage } from '@shared/ui';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useUserProfile,
  useFollowUser,
  useUnfollowUser,
  useAuthStore,
  useMyCertificates,
  useUserFollowers,
  useUserFollowing,
  useGetOrCreateConversation,
} from '@shared/hooks';
import { formatRelativeTime } from '@shared/utils';

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const t = useTranslations('profile');
  const currentUser = useAuthStore((s) => s.user);

  const { data: profileRaw, isLoading } = useUserProfile(userId);
  const profile = (
    profileRaw as {
      data?: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
        bio: string | null;
        role: string;
        followerCount: number;
        followingCount: number;
        createdAt: string;
        isFollowing: boolean | null;
        instructorProfile?: {
          headline: string | null;
          totalStudents: number;
          totalCourses: number;
        };
      };
    }
  )?.data;

  const router = useRouter();
  const getOrCreate = useGetOrCreateConversation();

  const isOwnProfile = currentUser?.id === userId;
  const [activeTab, setActiveTab] = useState(isOwnProfile ? 'certificates' : 'followers');
  const [followersPage, setFollowersPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);

  const { data: followersRaw } = useUserFollowers(userId, { page: followersPage, limit: 10 });
  const followersData = followersRaw as
    | {
        data?: Array<{ id: string; fullName: string; avatarUrl: string | null }>;
        meta?: { page: number; totalPages: number };
      }
    | undefined;
  const followers = followersData?.data ?? [];
  const followersMeta = followersData?.meta;

  const { data: followingRaw } = useUserFollowing(userId, { page: followingPage, limit: 10 });
  const followingData = followingRaw as
    | {
        data?: Array<{ id: string; fullName: string; avatarUrl: string | null }>;
        meta?: { page: number; totalPages: number };
      }
    | undefined;
  const following = followingData?.data ?? [];
  const followingMeta = followingData?.meta;

  const { data: certsData } = useMyCertificates();
  const certificates = isOwnProfile
    ? ((
        certsData as {
          data?: Array<{
            id: string;
            courseId: string;
            course: { title: string };
            issuedAt: string;
          }>;
        }
      )?.data ?? [])
    : [];

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const isFollowing = profile?.isFollowing ?? false;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const initials =
    profile?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '';

  const handleFollowToggle = () => {
    if (isFollowing) {
      unfollowUser.mutate(userId);
    } else {
      followUser.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-muted-foreground py-20 text-center">
        <p className="text-lg font-medium">{t('notFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <Avatar className="h-24 w-24">
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.fullName}</h1>
                {profile.role === 'INSTRUCTOR' && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                    <GraduationCap className="h-3 w-3" />
                    {t('instructorBadge')}
                  </span>
                )}
              </div>
              {profile.bio && <p className="text-muted-foreground mt-1">{profile.bio}</p>}
              {profile.instructorProfile?.headline && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {profile.instructorProfile.headline}
                </p>
              )}

              <div className="text-muted-foreground mt-3 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {t('joined')}{' '}
                  {new Date(profile.createdAt).toLocaleDateString('vi-VN', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('followers')}
                  className="text-center hover:opacity-80"
                >
                  <div className="font-bold">{profile.followerCount}</div>
                  <div className="text-muted-foreground text-xs">{t('followers')}</div>
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className="text-center hover:opacity-80"
                >
                  <div className="font-bold">{profile.followingCount}</div>
                  <div className="text-muted-foreground text-xs">{t('following')}</div>
                </button>
                {profile.instructorProfile && (
                  <>
                    <div className="text-center">
                      <div className="font-bold">{profile.instructorProfile.totalStudents}</div>
                      <div className="text-muted-foreground text-xs">{t('students')}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{profile.instructorProfile.totalCourses}</div>
                      <div className="text-muted-foreground text-xs">{t('courses')}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {isOwnProfile ? (
                <Link href="/profile/edit">
                  <Button variant="outline" className="gap-1.5">
                    <Pencil className="h-4 w-4" />
                    {t('editProfile')}
                  </Button>
                </Link>
              ) : isAuthenticated ? (
                <>
                  <Button
                    variant={isFollowing ? 'outline' : 'default'}
                    className="gap-1.5"
                    onClick={handleFollowToggle}
                    disabled={followUser.isPending || unfollowUser.isPending}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        {t('unfollow')}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        {t('follow')}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title={t('message')}
                    disabled={getOrCreate.isPending}
                    onClick={() =>
                      getOrCreate.mutate(
                        { participantId: userId },
                        {
                          onSuccess: (res) => {
                            const conv = (res as { data?: { id: string } })?.data;
                            if (conv?.id) router.push(`/chat?id=${conv.id}`);
                          },
                        },
                      )
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div>
        <div className="bg-muted mb-6 flex gap-1 rounded-lg p-1">
          {(isOwnProfile
            ? ['certificates', 'followers', 'following']
            : ['followers', 'following']
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`${tab}Tab` as 'certificatesTab')}
            </button>
          ))}
        </div>

        {activeTab === 'certificates' &&
          (certificates.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <Award className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>{t('noCertificates')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => (
                <Card key={cert.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                      <Award className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <span className="line-clamp-1 text-sm font-medium">{cert.course.title}</span>
                      <p className="text-muted-foreground text-xs">
                        {cert.issuedAt ? formatRelativeTime(cert.issuedAt) : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}

        {activeTab === 'followers' &&
          (followers.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>{t('noFollowers')}</p>
            </div>
          ) : (
            <div>
              <div className="space-y-2">
                {followers.map((u) => (
                  <a
                    key={u.id}
                    href={`/profile/${u.id}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg p-3"
                  >
                    <Avatar className="h-10 w-10">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                      <AvatarFallback>{u.fullName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.fullName}</span>
                  </a>
                ))}
              </div>
              {followersMeta && followersMeta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={followersPage <= 1}
                    onClick={() => setFollowersPage((p) => p - 1)}
                  >
                    {t('previous')}
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {followersPage} / {followersMeta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={followersPage >= followersMeta.totalPages}
                    onClick={() => setFollowersPage((p) => p + 1)}
                  >
                    {t('next')}
                  </Button>
                </div>
              )}
            </div>
          ))}

        {activeTab === 'following' &&
          (following.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>{t('noFollowing')}</p>
            </div>
          ) : (
            <div>
              <div className="space-y-2">
                {following.map((u) => (
                  <a
                    key={u.id}
                    href={`/profile/${u.id}`}
                    className="hover:bg-accent flex items-center gap-3 rounded-lg p-3"
                  >
                    <Avatar className="h-10 w-10">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                      <AvatarFallback>{u.fullName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.fullName}</span>
                  </a>
                ))}
              </div>
              {followingMeta && followingMeta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={followingPage <= 1}
                    onClick={() => setFollowingPage((p) => p - 1)}
                  >
                    {t('previous')}
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {followingPage} / {followingMeta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={followingPage >= followingMeta.totalPages}
                    onClick={() => setFollowingPage((p) => p + 1)}
                  >
                    {t('next')}
                  </Button>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

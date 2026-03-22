'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Camera, Loader2, ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@shared/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { useMe, useUpdateProfile, useAuthStore } from '@shared/hooks';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { toast } from 'sonner';

interface EditProfileValues {
  fullName: string;
  bio: string;
}

export default function EditProfilePage() {
  const t = useTranslations('editProfile');
  const router = useRouter();

  const { data: meRaw, isLoading } = useMe();
  const me = (
    meRaw as {
      data?: {
        id: string;
        fullName: string;
        bio: string | null;
        avatarUrl: string | null;
        email: string;
      };
    }
  )?.data;

  const updateProfile = useUpdateProfile();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error(t('avatarTooLarge'));
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    try {
      const result = await uploadToCloudinary(file, 'image');
      setAvatarPreview(result.secure_url);
    } catch {
      toast.error(t('avatarUploadFailed'));
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditProfileValues>();

  useEffect(() => {
    if (me) {
      reset({
        fullName: me.fullName,
        bio: me.bio ?? '',
      });
    }
  }, [me, reset]);

  const hasAvatarChange = avatarPreview && avatarPreview !== me?.avatarUrl;

  const onSubmit = (data: EditProfileValues) => {
    updateProfile.mutate(
      {
        fullName: data.fullName,
        bio: data.bio || undefined,
        ...(hasAvatarChange ? { avatarUrl: avatarPreview } : {}),
      },
      {
        onSuccess: () => {
          if (currentUser) {
            setUser({
              ...currentUser,
              fullName: data.fullName,
              ...(hasAvatarChange ? { avatarUrl: avatarPreview } : {}),
            });
          }
          toast.success(t('saved'));
          router.push(`/profile/${me?.id}`);
        },
      },
    );
  };

  const initials =
    me?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/profile/${me?.id}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToProfile')}
        </Link>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar */}
        <Card>
          <CardContent className="flex items-center gap-6 p-6">
            <div className="relative">
              <Avatar className="h-20 w-20">
                {(avatarPreview || me?.avatarUrl) && (
                  <AvatarImage
                    src={avatarPreview || me?.avatarUrl || ''}
                    alt={me?.fullName || ''}
                  />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-medium">{t('changeAvatar')}</p>
              <p className="text-muted-foreground text-sm">{t('avatarHint')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fullName')}</label>
              <Input
                {...register('fullName', { required: true, minLength: 2 })}
                placeholder={t('fullName')}
              />
              {errors.fullName && (
                <p className="text-destructive text-sm">{t('fullNameRequired')}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('email')}</label>
              <Input value={me?.email ?? ''} disabled className="opacity-60" />
              <p className="text-muted-foreground text-xs">{t('emailHint')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('bio')}</label>
              <textarea
                {...register('bio', { maxLength: 500 })}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={4}
                placeholder={t('bioPlaceholder')}
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateProfile.isPending || (!isDirty && !hasAvatarChange)}
          >
            {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}

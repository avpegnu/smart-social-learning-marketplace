'use client';

import { useTranslations } from 'next-intl';
import { Camera, Github, Linkedin, Globe } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  AvatarFallback,
} from '@shared/ui';

export default function EditProfilePage() {
  const t = useTranslations('editProfile');

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Avatar */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    MT
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  className="bg-primary text-primary-foreground absolute right-0 bottom-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full shadow"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h3 className="text-sm font-medium">{t('changeAvatar')}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{t('avatarHint')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('personalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('fullName')}</label>
              <Input defaultValue="Nguyễn Minh Tuấn" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('bio')}</label>
              <textarea
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[100px] w-full resize-y rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                placeholder={t('bioPlaceholder')}
                defaultValue="Frontend Developer | React Enthusiast | Lifelong Learner"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('phone')}</label>
              <Input defaultValue="0912345678" type="tel" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('location')}</label>
              <Input defaultValue="Ho Chi Minh City, Vietnam" />
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('socialLinks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Github className="h-4 w-4" /> GitHub
              </label>
              <Input
                placeholder="https://github.com/username"
                defaultValue="https://github.com/minhtuan"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Linkedin className="h-4 w-4" /> LinkedIn
              </label>
              <Input
                placeholder="https://linkedin.com/in/username"
                defaultValue="https://linkedin.com/in/minhtuan"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" /> Website
              </label>
              <Input placeholder="https://yoursite.com" defaultValue="https://minhtuan.dev" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            {t('saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  );
}

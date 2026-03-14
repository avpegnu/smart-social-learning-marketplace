'use client';

import { useTranslations } from 'next-intl';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '@shared/ui';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');

  const getStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = getStrength(password);
  const strengthLabels = [t('weak'), t('weak'), t('fair'), t('good'), t('strong')];
  const strengthColors = [
    'bg-destructive',
    'bg-destructive',
    'bg-warning',
    'bg-blue-500',
    'bg-success',
  ];

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
          <Lock className="text-primary h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        {/* New Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            {t('newPassword')}
          </label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('newPasswordPlaceholder')}
              className="pr-10 pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Strength Indicator */}
          {password.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      i < strength ? strengthColors[strength] : 'bg-muted',
                    )}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-xs">{strengthLabels[strength]}</p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            {t('confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder={t('confirmPasswordPlaceholder')}
              className="pr-10 pl-9"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full">
          {t('submit')}
        </Button>
      </form>
    </div>
  );
}

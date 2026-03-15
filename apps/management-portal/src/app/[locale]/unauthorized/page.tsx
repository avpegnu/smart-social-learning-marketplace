'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@shared/ui';
import { useLogout } from '@shared/hooks';
import { ShieldX, Loader2 } from 'lucide-react';

export default function UnauthorizedPage() {
  const t = useTranslations('auth');
  const logoutMutation = useLogout();

  const handleBackToLogin = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        window.location.href = '/login';
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="text-center">
          <CardHeader>
            <div className="bg-destructive/10 mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl">
              <ShieldX className="text-destructive h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">{t('unauthorized')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{t('unauthorizedDesc')}</p>
            <Button onClick={handleBackToLogin} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('backToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

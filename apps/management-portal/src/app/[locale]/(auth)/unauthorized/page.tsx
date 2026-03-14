'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@shared/ui';
import { Link } from '@/i18n/navigation';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  const t = useTranslations('auth');

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="bg-destructive/10 mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl">
          <ShieldX className="text-destructive h-8 w-8" />
        </div>
        <CardTitle className="text-2xl">{t('unauthorized')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{t('unauthorizedDesc')}</p>
        <Link href="/login">
          <Button>{t('backToLogin')}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

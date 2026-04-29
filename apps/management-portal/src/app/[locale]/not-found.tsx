import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFoundPage() {
  const t = useTranslations('notFound');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <p className="text-muted-foreground text-7xl font-bold">404</p>
        <h1 className="mt-4 text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>
      <Link
        href="/instructor/dashboard"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-6 text-sm font-medium transition-colors"
      >
        {t('backToDashboard')}
      </Link>
    </div>
  );
}

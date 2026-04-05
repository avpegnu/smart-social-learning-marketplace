'use client';

import { useTranslations } from 'next-intl';
import { Award, ExternalLink, Share2, BookOpen } from 'lucide-react';
import { Button, Card, CardContent, Skeleton } from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import { useMyCertificates } from '@shared/hooks';
import { formatDate } from '@shared/utils';
import { toast } from 'sonner';

interface CertificateItem {
  id: string;
  courseId: string;
  verifyCode: string;
  certificateUrl: string | null;
  createdAt: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
  };
}

export default function CertificatesPage() {
  const t = useTranslations('certificates');
  const { data, isLoading } = useMyCertificates();
  const certificates = (data?.data as CertificateItem[]) ?? [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState icon={Award} title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    );
  }

  const handleShare = (verifyCode: string) => {
    const url = `${window.location.origin}/certificates/verify/${verifyCode}`;
    navigator.clipboard?.writeText(url);
    toast.success(t('linkCopied'));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {certificates.map((cert) => (
          <Card key={cert.id} className="overflow-hidden">
            {/* Thumbnail */}
            {cert.course.thumbnailUrl ? (
              <div className="relative aspect-video">
                <img
                  src={cert.course.thumbnailUrl}
                  alt={cert.course.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm">
                    <Award className="text-success h-4 w-4" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="from-primary/20 to-primary/5 relative flex aspect-video items-center justify-center bg-gradient-to-br">
                <BookOpen className="text-primary/30 h-12 w-12" />
                <div className="absolute top-2 right-2">
                  <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-full">
                    <Award className="text-success h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            <CardContent className="p-4">
              <h3 className="mb-1 line-clamp-2 text-sm font-semibold">{cert.course.title}</h3>
              <p className="text-muted-foreground mb-4 text-xs">
                {t('completedOn')}: {formatDate(cert.createdAt)}
              </p>

              <div className="flex gap-2">
                {cert.certificateUrl && (
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => window.open(cert.certificateUrl!, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('viewCertificate')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleShare(cert.verifyCode)}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {t('share')}
                </Button>
              </div>

              <p className="text-muted-foreground mt-3 truncate text-[10px]">
                {t('verifyCode')}: {cert.verifyCode}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Award, Download, ExternalLink, BookOpen } from 'lucide-react';
import { Button, Card, CardContent } from '@shared/ui';
import { EmptyState } from '@/components/feedback/empty-state';
import { mockCertificates } from '@/lib/mock-data';

export default function CertificatesPage() {
  const t = useTranslations('certificates');

  if (mockCertificates.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
        <EmptyState icon={Award} title={t('emptyTitle')} description={t('emptyDesc')} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockCertificates.map((cert) => (
          <Card key={cert.id} className="overflow-hidden">
            {/* Thumbnail */}
            <div className="from-primary/20 to-primary/5 relative flex aspect-video items-center justify-center bg-gradient-to-br">
              <BookOpen className="text-primary/30 h-12 w-12" />
              <div className="absolute top-2 right-2">
                <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-full">
                  <Award className="text-success h-4 w-4" />
                </div>
              </div>
            </div>

            <CardContent className="p-4">
              <h3 className="mb-1 line-clamp-2 text-sm font-semibold">{cert.courseTitle}</h3>
              <p className="text-muted-foreground mb-1 text-xs">{cert.instructor}</p>
              <p className="text-muted-foreground mb-4 text-xs">
                {t('completedOn')}: {new Date(cert.completionDate).toLocaleDateString('vi-VN')}
              </p>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('viewCertificate')}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {t('downloadPdf')}
                </Button>
              </div>

              <p className="text-muted-foreground mt-3 truncate text-[10px]">
                {t('verifyAt')}: {cert.verifyUrl}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

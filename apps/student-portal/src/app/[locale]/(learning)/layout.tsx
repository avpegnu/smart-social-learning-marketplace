'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button, Progress } from '@shared/ui';

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  const _t = useTranslations('learning');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal header */}
      <header className="border-border bg-background sticky top-0 z-40 border-b">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/my-learning">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">React & Next.js Full-Stack</h1>
            <div className="mt-1 flex items-center gap-2">
              <Progress value={65} className="h-1.5 max-w-xs flex-1" />
              <span className="text-muted-foreground text-xs whitespace-nowrap">65%</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="shrink-0">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

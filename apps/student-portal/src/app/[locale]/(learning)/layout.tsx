'use client';

import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@shared/ui';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        {/* Minimal header */}
        <header className="border-border bg-background sticky top-0 z-40 border-b">
          <div className="flex h-14 items-center gap-4 px-4">
            <Link href="/my-learning">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            {/* Course title + progress rendered by page via portal or inline */}
            <div id="learning-header-slot" className="min-w-0 flex-1" />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}

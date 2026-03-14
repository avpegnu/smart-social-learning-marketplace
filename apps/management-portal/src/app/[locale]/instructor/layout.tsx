'use client';

import { useSidebarStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/navigation/sidebar';
import { Header } from '@/components/navigation/header';
import { DesktopGuard } from '@/components/desktop-guard';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();

  return (
    <DesktopGuard>
      <div className="bg-background min-h-screen">
        <Sidebar variant="instructor" />
        <Header variant="instructor" />
        <main
          className={cn(
            'pt-16 transition-all duration-300',
            collapsed ? 'ml-[var(--spacing-sidebar-collapsed)]' : 'ml-[var(--spacing-sidebar)]',
          )}
        >
          <div className="mx-auto max-w-7xl p-6">{children}</div>
        </main>
      </div>
    </DesktopGuard>
  );
}

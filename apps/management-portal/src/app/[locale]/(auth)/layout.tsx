import { DesktopGuard } from '@/components/desktop-guard';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopGuard>
      <div className="bg-muted/30 flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </DesktopGuard>
  );
}

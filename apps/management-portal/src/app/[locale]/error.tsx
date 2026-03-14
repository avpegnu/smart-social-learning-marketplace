'use client';

import { Button } from '@shared/ui';
import { AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <AlertTriangle className="text-destructive mx-auto h-16 w-16" />
        <h1 className="mt-4 text-2xl font-bold">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          {error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại sau.'}
        </p>
      </div>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}

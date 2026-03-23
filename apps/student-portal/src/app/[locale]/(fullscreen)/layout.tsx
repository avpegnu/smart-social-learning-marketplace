import { Navbar } from '@/components/navigation/navbar';

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

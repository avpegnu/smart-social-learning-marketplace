import { Navbar } from '@/components/navigation/navbar';
import { SocketProvider } from '@/components/providers/socket-provider';

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <SocketProvider />
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

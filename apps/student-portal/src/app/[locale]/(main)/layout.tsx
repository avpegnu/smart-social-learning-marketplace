import { Navbar } from '@/components/navigation/navbar';
import { Footer } from '@/components/navigation/footer';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { SocketProvider } from '@/components/providers/socket-provider';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SocketProvider />
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}

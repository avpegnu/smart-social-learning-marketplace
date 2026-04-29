import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Root layout sits outside the [locale] route segment and cannot read
// next-intl messages. We keep an English fallback here; per-locale metadata
// can be added later via generateMetadata() in app/[locale]/layout.tsx.
export const metadata: Metadata = {
  title: 'Smart Social Learning Marketplace',
  description: 'Online learning platform combining social network and AI Tutor',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

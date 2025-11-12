import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'HEX Ops - SaaS Chiffrage CVC/Plomberie',
  description: 'Automatisez et fiabilisez votre chiffrage CVC/Plomberie',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="bg-neutral-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

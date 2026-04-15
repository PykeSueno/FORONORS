import './globals.css';
import type { Metadata } from 'next';
import { SessionTokenBridge } from '@/components/auth/session-token-bridge';

export const metadata: Metadata = {
  title: 'FORONORS',
  description: 'Plateforme FORONORS'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SessionTokenBridge />
        {children}
      </body>
    </html>
  );
}

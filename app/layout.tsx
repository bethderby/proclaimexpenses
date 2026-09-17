import type { Metadata } from 'next';
import { Dancing_Script, Inter } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const dancingScript = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-cursive' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Proclaim Expenses',
  description: 'Submit, approve, and track team expenses.',
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dancingScript.variable} ${inter.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Dancing_Script } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const dancingScript = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-cursive' });

export const metadata: Metadata = {
  title: 'Proclaim Expenses — team expenses',
  description: 'Submit, approve, and track team expenses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dancingScript.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'EnglishX — AI English Speaking Coach',
  description: 'Voice-first AI English speaking coach. Practise speaking, get specific feedback on pronunciation, vocabulary, and grammar, and track your progress.',
  keywords: ['English', 'speaking', 'AI', 'coach', 'pronunciation', 'grammar', 'vocabulary'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

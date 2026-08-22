import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import { Providers } from '@/components/providers/Providers';
import '@/styles/tokens.css';
import './globals.css';

const nunitoSans = Nunito_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Цифровий світ класу — твоя парта онлайн',
  description:
    'Закрите цифрове середовище для учнів 1–4 класів: навчання, творчість, квести та життя класу.',
  openGraph: {
    title: 'Цифровий світ класу',
    description:
      'Місце, де можна навчатися, спілкуватися, творити та залишатися разом із класом.',
    type: 'website',
    locale: 'uk_UA',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={nunitoSans.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

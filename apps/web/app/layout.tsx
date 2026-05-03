import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://wingmic.xyz'),
  title: {
    default: 'wingmic.xyz — your social RAM, on disk',
    template: '%s · wingmic',
  },
  description:
    'Voice-first networking memory. Speak after you meet someone. Wingmic extracts the people, companies, events, and follow-ups, and builds a graph you can actually query.',
  keywords: [
    'networking',
    'memory graph',
    'voice capture',
    'CRM alternative',
    'AI memory',
    'open source',
    'developer tools',
  ],
  authors: [{ name: 'wingmic contributors' }],
  openGraph: {
    type: 'website',
    siteName: 'wingmic',
    title: 'wingmic.xyz — your social RAM, on disk',
    description:
      'Voice-first networking memory. Speak after you meet someone. Wingmic extracts the people, companies, events, and follow-ups.',
    url: 'https://wingmic.xyz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'wingmic.xyz — your social RAM, on disk',
    description:
      'Voice-first networking memory. Speak. Extract. Query.',
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

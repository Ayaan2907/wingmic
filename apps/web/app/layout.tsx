import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { TRPCProvider } from '@/lib/trpc/client';
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
    'networking tool for developers',
    'voice-first CRM',
    'networking memory graph',
    'AI networking assistant',
    'CRM alternative for developers',
    'conference networking app',
    'voice memo CRM',
    'MCP server networking',
    'relationship graph API',
    'open source CRM',
    'developer networking tool',
    'remember people you meet',
  ],
  authors: [{ name: 'wingmic contributors' }],
  creator: 'wingmic',
  publisher: 'wingmic',
  category: 'developer tools',
  openGraph: {
    type: 'website',
    siteName: 'wingmic',
    title: 'wingmic — voice-first networking memory for developers',
    description:
      'Stop losing connections. Speak after you meet someone — Wingmic extracts people, companies, events, and follow-ups into a queryable knowledge graph. REST API, MCP server, MIT-licensed.',
    url: 'https://wingmic.xyz',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'wingmic — your social RAM, on disk',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ayaan2907',
    creator: '@ayaan2907',
    title: 'wingmic — your social RAM, on disk',
    description:
      'Voice-first networking memory for developers. Speak. Extract. Query. Open beta.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://wingmic.xyz',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/icon-32.png'],
  },
  manifest: '/manifest.webmanifest',
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
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}

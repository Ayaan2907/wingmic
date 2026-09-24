import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { TRPCProvider } from '@/lib/trpc/client';
import { CaptureProvider } from './_components/CaptureProvider';
import { AppShell } from './_components/AppShell';
import { RecordingOverlay } from './_components/RecordingOverlay';
import { ServiceWorkerRegistrar } from './_components/ServiceWorkerRegistrar';
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
  metadataBase: new URL('https://app.wingmic.xyz'),
  title: { default: 'wingmic', template: '%s · wingmic' },
  description: 'your social RAM, on disk.',
  manifest: '/manifest.webmanifest', // PWA installability — copied to public/ by prebuild
  robots: { index: false, follow: false }, // product app not indexed
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // engages env(safe-area-inset-*) on notched devices
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <TRPCProvider>
          <CaptureProvider>
            <AppShell>{children}</AppShell>
            <RecordingOverlay />
            <ServiceWorkerRegistrar />
          </CaptureProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}

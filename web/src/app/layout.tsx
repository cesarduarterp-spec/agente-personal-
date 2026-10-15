import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/sw-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agenda · Asistente Ejecutivo',
  description: 'Agenda personal voice-first sincronizada con Telegram.',
  manifest: '/manifest.json',
  applicationName: 'Agenda',
  appleWebApp: { capable: true, title: 'Agenda', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

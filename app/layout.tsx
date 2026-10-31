import type { Metadata } from 'next'
import { Archivo, Instrument_Serif, Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000'

const appDescription =
  'Looksee finds the overlap in your friends\' watchlists, making "what should we watch?" simple.'

// The width axis lets the marketing pages set Archivo expanded for display
// type; everything else keeps the default width.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  axes: ['wdth'],
})

// Accent face for a word or two in marketing headlines.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Looksee - Collaborative Movie & Show Recommendations',
  description: appDescription,
  openGraph: {
    title: 'Looksee - Collaborative Movie & Show Recommendations',
    description: appDescription,
    type: 'website',
    videos: [
      {
        url: '/welcome.mp4',
        secureUrl: '/welcome.mp4',
        type: 'video/mp4',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Looksee - Collaborative Movie & Show Recommendations',
    description: appDescription,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon-180x180.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'theme-color': '#ffffff',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' className={`${archivo.variable} ${inter.variable} ${instrumentSerif.variable}`}>
      <body className='antialiased overscroll-none'>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}

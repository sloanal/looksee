import type { Metadata } from 'next'
import { Archivo, Instrument_Serif, Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  'http://localhost:3000'

const appTitle = 'Looksee: spend less time deciding what to watch'

const appDescription =
  'One shared watchlist for you and everyone you watch with. Hit one big button and get the pick the whole room actually wants.'

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
  title: appTitle,
  description: appDescription,
  // The preview image is app/opengraph-image.png (+ twitter-image.png), made by
  // scripts/generate-og-image.js. There's deliberately no og:video: iMessage
  // can prefer a video over the image, which would hide the card.
  openGraph: {
    title: appTitle,
    description: appDescription,
    siteName: 'Looksee',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: appTitle,
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

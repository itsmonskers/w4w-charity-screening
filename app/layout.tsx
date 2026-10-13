import type { Metadata, Viewport } from 'next'
import { Cinzel, Hanken_Grotesk } from 'next/font/google'
import { EVENT } from '@/lib/event-config'
import './globals.css'
const display = Cinzel({ subsets: ['latin','latin-ext'], weight: ['600','700'], variable: '--font-display' })
const body = Hanken_Grotesk({ subsets: ['latin','latin-ext'], weight: ['400','500','600','700'], variable: '--font-body' })
const title = `Movies4Water - ${EVENT.film} Block Screening`
const description = `Reserve your seat for the Waves for Water Philippines block screening at Cinema 7, ${EVENT.venue}. Your seat helps bring clean water to Filipino communities.`
// Netlify sets URL at build time; link previews need absolute image URLs
export const metadata: Metadata = {
  metadataBase: new URL(process.env.URL ?? 'http://localhost:3000'),
  title,
  description,
  openGraph: { title, description, siteName: 'Waves for Water Philippines', type: 'website', locale: 'en_PH' },
  twitter: { card: 'summary_large_image', title, description },
}
export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#161b20' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html> }

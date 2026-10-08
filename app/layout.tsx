import type { Metadata, Viewport } from 'next'
import { Oswald, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
const display = Oswald({ subsets: ['latin','latin-ext'], weight: ['500','600','700'], variable: '--font-display' })
const body = Hanken_Grotesk({ subsets: ['latin','latin-ext'], weight: ['400','500','600','700'], variable: '--font-body' })
export const metadata: Metadata = { title: 'Doomsday Charity Screening · Waves for Water Philippines', description: 'Reserve seats for the Waves for Water Philippines charity screening.' }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#161b20' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html> }

import type { Metadata, Viewport } from 'next'
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ProvedorTema } from '@/components/tema/ProvedorTema'
import './globals.css'

const barlow = Barlow({ variable: '--font-barlow', subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const barlowCondensed = Barlow_Semi_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Painel de Mobilização · Timenow',
  description: 'Acompanhamento das contratações da Mobilização Braskem 2027',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2b6157' },
    { media: '(prefers-color-scheme: dark)', color: '#173a33' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}>
        <ProvedorTema>{children}</ProvedorTema>
      </body>
    </html>
  )
}

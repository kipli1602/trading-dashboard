import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/app/globals.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Crypto AI Bot Dashboard',
  description: 'Auto Trading Bot for 9 Crypto Pairs - AI-Powered',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-bg text-gray-100`}>
        {children}
      </body>
    </html>
  )
}
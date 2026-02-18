import type { Metadata } from 'next'
import './globals.css'

import { startServer } from '../../server/startup'

export const metadata: Metadata = {
  title: 'Setup Data Success Rate Grafana',
  description: 'Dashboard untuk manage data success rate Grafana',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await startServer()

  return (
    <html lang="id">
      <head>
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
          async
        />
      </head>
      <body className="font-sans bg-gray-50">
        {children}
      </body>
    </html>
  )
}

import React from 'react'
import ClientLayout from './client-layout'
import './globals.css'

export const metadata = {
  title: 'JQuality - Test Intelligence Platform',
  description: 'Centralized intelligence platform connecting Jira, GitHub, and Confluence for automated test scenarios and documentation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased aqua-ext-enabled">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}

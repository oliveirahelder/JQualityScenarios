'use client'

import Navbar from '@/components/Navbar'
import { usePathname } from 'next/navigation'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const showNavbar = pathname !== '/login'

  return (
    <>
      {showNavbar && <Navbar />}
      <main className="min-h-screen">
        {children}
      </main>
    </>
  )
}

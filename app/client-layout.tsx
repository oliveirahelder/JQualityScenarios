'use client'

import Sidebar from '@/components/Sidebar'
import { usePathname } from 'next/navigation'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const showSidebar = pathname !== '/login'

  return (
    <div className="min-h-screen flex">
      {showSidebar ? <Sidebar /> : null}
      <main className="flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}

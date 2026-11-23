import type { Metadata } from 'next'
import { AdminDashboard } from '@/components/admin-dashboard'
import { AdminModeGate } from '@/components/admin-mode-gate'

export const metadata: Metadata = {
  title: 'Admin · Movies4Water',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default function AdminPage() {
  return <AdminModeGate><AdminDashboard /></AdminModeGate>
}

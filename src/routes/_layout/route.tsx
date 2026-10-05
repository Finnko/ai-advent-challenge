import { createFileRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export const Route = createFileRoute('/_layout')({ component: AppLayout })

function AppLayout() {
  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

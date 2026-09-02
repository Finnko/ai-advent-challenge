import { createFileRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '../../components/Sidebar'

export const Route = createFileRoute('/_layout')({ component: AppLayout })

function AppLayout() {
  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, DollarSign, UserCog, Shield,
  BarChart3, ScrollText, TrendingUp, MessageSquare, Settings, X, ChevronLeft, ChevronRight, Calendar, LineChart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Affiliates', href: '/dashboard/affiliates', icon: Users },
  { name: 'Brokers', href: '/dashboard/brokers', icon: Building2 },
  { name: 'Revenue', href: '/dashboard/revenue', icon: DollarSign },
  { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Analytics', href: '/dashboard/analytics', icon: LineChart },
]

const adminItems = [
  { name: 'Company KPIs', href: '/dashboard/company-kpis', icon: BarChart3 },
  { name: 'Staff', href: '/dashboard/staff', icon: UserCog },
  { name: 'Users', href: '/dashboard/users', icon: Shield },
  { name: 'Audit Log', href: '/dashboard/audit', icon: ScrollText },
]

const personalItems = [
  // My Performance: visible to all roles — each user sees only their own data
  { name: 'My Performance', href: '/dashboard/my-performance', icon: TrendingUp },
  { name: 'AI Chat', href: '/dashboard/ai-chat', icon: MessageSquare },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen, userRole }) {
  const pathname = usePathname()
  const isAdmin = userRole === 'ADMIN'

  const NavLink = ({ item }) => {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
        )}
        <item.icon className={cn('w-5 h-5 shrink-0', active && 'text-primary')} />
        {!collapsed && <span className="truncate">{item.name}</span>}
      </Link>
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-outfit font-bold text-lg">FX Unlocked</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center mx-auto">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-7 w-7"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && <p className="text-xs font-medium text-muted-foreground px-3 pt-2 pb-1 uppercase tracking-wider">Main</p>}
        {navItems.map(item => <NavLink key={item.href} item={item} />)}

        {isAdmin && (
          <>
            {!collapsed && <p className="text-xs font-medium text-muted-foreground px-3 pt-4 pb-1 uppercase tracking-wider">Admin</p>}
            {adminItems.map(item => <NavLink key={item.href} item={item} />)}
          </>
        )}

        {!collapsed && <p className="text-xs font-medium text-muted-foreground px-3 pt-4 pb-1 uppercase tracking-wider">Personal</p>}
        {personalItems.filter(item => !item.adminOnly || isAdmin).map(item => <NavLink key={item.href} item={item} />)}
      </nav>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 lg:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 shrink-0',
        collapsed ? 'w-[68px]' : 'w-64'
      )}>
        {sidebarContent}
      </aside>
    </>
  )
}

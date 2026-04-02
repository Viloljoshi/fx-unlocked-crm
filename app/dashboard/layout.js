'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProvider, useUser } from '@/lib/context/UserContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import CommandBar from '@/components/command-bar/CommandBar'
import AIChat from '@/components/chat/AIChat'
import TutorialOverlay from '@/components/ui/TutorialOverlay'

// Inner layout reads from UserContext — no additional auth/DB calls
function DashboardInner({ children }) {
  const { user, profile, loading, refetchProfile } = useUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const supabase = createClient()

  const showTutorial = !loading && profile && profile.onboarded_at === null

  const handleTutorialComplete = async () => {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', user.id)
    await refetchProfile()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        userRole={profile?.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          onCommandBarOpen={() => setCommandBarOpen(true)}
          onAIChatToggle={() => setAiChatOpen(!aiChatOpen)}
          profile={profile}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
      <CommandBar open={commandBarOpen} setOpen={setCommandBarOpen} userId={user?.id} />
      <AIChat open={aiChatOpen} setOpen={setAiChatOpen} />
      {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
    </div>
  )
}

// UserProvider wraps everything — one auth + one DB call for the entire session
export default function DashboardLayout({ children }) {
  return (
    <UserProvider>
      <DashboardInner>{children}</DashboardInner>
    </UserProvider>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import CommandBar from '@/components/command-bar/CommandBar'
import AIChat from '@/components/chat/AIChat'
import TutorialOverlay from '@/components/ui/TutorialOverlay'

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      setUser(authUser)

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist — create it (first-time user)
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            first_name: authUser.user_metadata?.first_name || '',
            last_name: authUser.user_metadata?.last_name || '',
            role: authUser.user_metadata?.role || 'STAFF',
            is_active: true,
          })
          .select()
          .single()
        setProfile(newProfile)
        // Brand-new profile has no onboarded_at — show tutorial
        setShowTutorial(true)
      } else {
        setProfile(profileData)
        // Existing user who hasn't completed onboarding
        if (profileData && profileData.onboarded_at === null) {
          setShowTutorial(true)
        }
      }
    }
    loadProfile()
  }, [])

  const handleTutorialComplete = async () => {
    setShowTutorial(false)
    if (!user) return
    await supabase
      .from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', user.id)
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

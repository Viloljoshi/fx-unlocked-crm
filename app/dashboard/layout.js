'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import CommandBar from '@/components/command-bar/CommandBar'
import AIChat from '@/components/chat/AIChat'

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
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
        // Profile doesn't exist, create it
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            first_name: authUser.user_metadata?.first_name || '',
            last_name: authUser.user_metadata?.last_name || '',
            role: 'STAFF',
          })
          .select()
          .single()
        setProfile(newProfile)
      } else {
        setProfile(profileData)
      }
    }
    loadProfile()
  }, [supabase])

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
    </div>
  )
}

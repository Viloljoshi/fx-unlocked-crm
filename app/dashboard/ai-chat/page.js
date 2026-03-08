'use client'

import AIChat from '@/components/chat/AIChat'

export default function AIChatPage() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-outfit font-bold">AI Insights</h1>
        <p className="text-sm text-muted-foreground">Chat with AI about your CRM data</p>
      </div>
      <div className="h-[calc(100%-4rem)] rounded-xl border border-border bg-card overflow-hidden">
        <AIChat open={true} setOpen={() => {}} isFullPage={true} />
      </div>
    </div>
  )
}

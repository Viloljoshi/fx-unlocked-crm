'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Send, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const STARTERS = [
  'Which affiliates closed the most deals this year?',
  'Show pending commissions by broker',
  'Who are the top performing staff this quarter?',
  'How many affiliates are up for renewal this month?',
]

export default function AIChat({ open, setOpen, isFullPage = false }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || isStreaming) return
    setInput('')

    const userMsg = { role: 'user', content: msg }
    const assistantMsg = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: [...messages, userMsg] }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullContent += parsed.text
                const currentContent = fullContent
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    last.content = currentContent
                  }
                  return [...updated]
                })
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant') {
          last.content = 'Sorry, I encountered an error. Please try again.'
        }
        return [...updated]
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      {!isFullPage && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-outfit font-semibold">AI Insights</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-primary/50 mx-auto mb-3" />
              <h4 className="font-outfit font-semibold text-lg">Ask about your CRM data</h4>
              <p className="text-sm text-muted-foreground mt-1">I can analyze affiliates, revenue, and performance</p>
            </div>
            <div className="grid gap-2">
              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-4 ${m.role === 'user' ? 'flex justify-end' : ''}`}>
            {m.role === 'user' ? (
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md gradient-primary text-white text-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[90%] space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">AI</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-border [&_th]:bg-secondary/50 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:py-1 [&_pre]:bg-secondary [&_pre]:rounded-lg [&_code]:text-xs [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
            disabled={isStreaming}
          />
          <Button type="submit" size="icon" className="gradient-primary text-white shrink-0" disabled={isStreaming || !input.trim()}>
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  )

  if (isFullPage) return chatContent

  if (!open) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 max-w-full bg-card border-l border-border shadow-2xl animate-slide-in">
      {chatContent}
    </div>
  )
}

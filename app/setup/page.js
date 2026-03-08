'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Copy, ExternalLink, RefreshCw, TrendingUp } from 'lucide-react'

export default function SetupPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sql, setSql] = useState('')

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      setStatus(data)
      if (data.migrationSQL) setSql(data.migrationSQL)
    } catch (err) {
      toast.error('Failed to check database status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkStatus() }, [])

  const copySQL = () => {
    navigator.clipboard.writeText(sql)
    toast.success('SQL copied to clipboard!')
  }

  const supabaseRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '')

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-outfit font-bold">FX Unlocked — Database Setup</h1>
            <p className="text-muted-foreground">Set up your Supabase database tables</p>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Table Status
              <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Check Again
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status && (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(status.tables || {}).map(([table, ready]) => (
                  <div key={table} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                    {ready ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
                    <span className="text-sm font-mono">{table}</span>
                  </div>
                ))}
              </div>
            )}
            {status?.ready && (
              <div className="mt-4 p-4 rounded-lg bg-success/10 border border-success/20">
                <p className="text-success font-medium">All tables are ready! You can now <a href="/login" className="underline">sign in</a>.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!status?.ready && sql && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Migration SQL</CardTitle>
              <CardDescription>Copy this SQL and run it in your Supabase SQL Editor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={copySQL} variant="outline">
                  <Copy className="w-4 h-4 mr-2" /> Copy SQL
                </Button>
                <Button asChild variant="outline">
                  <a href={`https://supabase.com/dashboard/project/${supabaseRef}/sql/new`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open SQL Editor
                  </a>
                </Button>
              </div>
              <div className="max-h-96 overflow-auto rounded-lg bg-secondary p-4">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{sql}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

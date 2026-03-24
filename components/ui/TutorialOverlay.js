'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Users, Building2, DollarSign,
  Target, BarChart3, ChevronRight, ChevronLeft,
  X, Sparkles, CheckCircle2,
} from 'lucide-react'

const STEPS = [
  {
    icon: Sparkles,
    iconBg: 'bg-gradient-to-br from-cyan-400 to-blue-500',
    title: 'Welcome to FX Unlocked CRM',
    subtitle: 'Your complete affiliate & IB management platform',
    description: "We'll give you a quick 30-second tour of the key areas so you can hit the ground running. You can always revisit this tour from Settings.",
    tips: [],
  },
  {
    icon: LayoutDashboard,
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    title: 'Dashboard',
    subtitle: 'Your business at a glance',
    description: 'The Dashboard gives you a live overview of your entire operation — total affiliates, revenue, pending payments, and onboarding pipeline.',
    tips: [
      'Switch between Overview and Affiliate Dashboard tabs',
      'Build custom dashboards with the "+ New Dashboard" button',
      'All charts update in real time',
    ],
  },
  {
    icon: Users,
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    title: 'Affiliates / IBs',
    subtitle: 'Manage your entire affiliate network',
    description: 'Add, edit, and track every affiliate and Introducing Broker. Each affiliate can be linked to multiple brokers, assigned a manager, and tagged with deal terms.',
    tips: [
      'Assign multiple brokers to a single affiliate',
      'Track status: Lead → Onboarding → Active',
      'Add call, meeting & email notes to each affiliate',
    ],
  },
  {
    icon: Building2,
    iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    title: 'Brokers',
    subtitle: 'Track all broker relationships',
    description: 'Manage your broker partners, their deal types (CPA, PNL, HYBRID, REBATES), contact details, and see aggregated affiliate counts and revenue per broker.',
    tips: [
      'Only Admins can add or edit brokers',
      'Revenue shown is filtered to your own records if you\'re Staff',
    ],
  },
  {
    icon: DollarSign,
    iconBg: 'bg-gradient-to-br from-green-400 to-emerald-600',
    title: 'Revenue & Commissions',
    subtitle: 'Track every commission record',
    description: 'Log, track and manage commissions by month, year, deal type, and status. Mark commissions as Paid once confirmed.',
    tips: [
      'Filter by affiliate, broker, status, or date range',
      'Staff see only commissions tagged to them',
      'Export to CSV at any time',
    ],
  },
  {
    icon: Target,
    iconBg: 'bg-gradient-to-br from-rose-400 to-pink-600',
    title: 'KPI Targets',
    subtitle: 'Company & per-staff performance tracking',
    description: 'Set monthly or yearly revenue and affiliate sign-up targets — either company-wide under Company KPIs, or per staff member under Staff → KPI Targets.',
    tips: [
      'Actuals are calculated live — no manual input needed',
      'Colour-coded progress: green ≥ 100%, yellow ≥ 70%, red < 70%',
      'Staff can only view their own KPI targets',
    ],
  },
  {
    icon: BarChart3,
    iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    title: "You're all set!",
    subtitle: 'Start managing your affiliate business',
    description: "That's everything you need to know to get started. Explore at your own pace — every page has filters, search, and CSV export built in.",
    tips: [
      'Use the ⌘K command bar to quickly jump anywhere',
      'The AI Chat assistant can answer CRM questions',
      'Check Settings to manage your profile',
    ],
  },
]

export default function TutorialOverlay({ onComplete }) {
  const [step, setStep] = useState(0)
  const [exiting, setExiting] = useState(false)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const Icon = current.icon

  const finish = () => {
    setExiting(true)
    setTimeout(() => onComplete(), 300)
  }

  const next = () => {
    if (isLast) { finish(); return }
    setStep(s => s + 1)
  }

  const back = () => setStep(s => Math.max(0, s - 1))

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden border border-border">

        {/* Progress bar */}
        <div className="h-1 bg-muted w-full">
          <div
            className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          aria-label="Skip tutorial"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl ${current.iconBg} flex items-center justify-center mb-5 shadow-lg`}>
            <Icon className="w-7 h-7 text-white" />
          </div>

          {/* Step counter */}
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
            Step {step + 1} of {STEPS.length}
          </p>

          {/* Title */}
          <h2 className="text-xl font-outfit font-bold mb-1">{current.title}</h2>
          <p className="text-sm font-medium text-primary mb-3">{current.subtitle}</p>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {current.description}
          </p>

          {/* Tips */}
          {current.tips.length > 0 && (
            <ul className="space-y-2 mb-6">
              {current.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{tip}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-5 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={back} className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            <Button onClick={next} className="flex-1 gap-1" size="sm">
              {isLast ? (
                <>Let&apos;s go! <Sparkles className="w-4 h-4" /></>
              ) : (
                <>Next <ChevronRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

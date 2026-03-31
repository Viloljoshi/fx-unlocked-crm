'use client'

import { Badge } from '@/components/ui/badge'

const statusConfig = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300' },
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  ARCHIVED: { label: 'Archived', className: 'bg-slate-100 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400' },
}

export default function DealStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.DRAFT
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  )
}

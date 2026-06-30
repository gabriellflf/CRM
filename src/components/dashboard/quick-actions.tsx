"use client"

import Link from 'next/link'
import { UserPlus, Briefcase } from 'lucide-react'
import type { ComponentType } from 'react'

interface Action {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  { label: 'Criar novo contato', href: '/contacts', icon: UserPlus, tint: 'text-primary' },
  { label: 'Criar novo negócio', href: '/pipelines', icon: Briefcase, tint: 'text-blue-400' },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-border hover:bg-muted/60"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

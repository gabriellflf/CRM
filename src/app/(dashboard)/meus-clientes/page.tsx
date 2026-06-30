"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageSquare, Users, GitBranch, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientRow {
  contact_id: string
  name: string | null
  phone: string
  lastMessageAt: string | null
  lastMessageText: string | null
  conversationStatus: string
  openDeals: number
}

interface Summary {
  totalClients: number
  activeConversations: number
  openDeals: number
  avgResponseMin: number | null
}

export default function MeusClientesPage() {
  const { user, profileLoading } = useAuth()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (profileLoading || !user?.id) return

    const db = createClient()

    ;(async () => {
      setLoading(true)

      // Conversations assigned to this operator
      const { data: convs } = await db
        .from('conversations')
        .select('id, status, last_message_at, last_message_text, contact:contacts(id, name, phone)')
        .eq('assigned_agent_id', user.id)
        .order('last_message_at', { ascending: false })

      if (!convs || convs.length === 0) {
        setSummary({ totalClients: 0, activeConversations: 0, openDeals: 0, avgResponseMin: null })
        setClients([])
        setLoading(false)
        return
      }

      // Unique contacts
      const contactMap = new Map<string, ClientRow>()
      for (const c of convs) {
        const contact = Array.isArray(c.contact) ? c.contact[0] : c.contact
        if (!contact) continue
        if (!contactMap.has(contact.id)) {
          contactMap.set(contact.id, {
            contact_id: contact.id,
            name: contact.name,
            phone: contact.phone,
            lastMessageAt: c.last_message_at,
            lastMessageText: c.last_message_text,
            conversationStatus: c.status,
            openDeals: 0,
          })
        }
      }

      // Open deals for these contacts
      const contactIds = [...contactMap.keys()]
      if (contactIds.length > 0) {
        const { data: deals } = await db
          .from('deals')
          .select('contact_id')
          .in('contact_id', contactIds)
          .eq('status', 'open')

        for (const deal of deals ?? []) {
          const row = contactMap.get(deal.contact_id)
          if (row) row.openDeals++
        }
      }

      const rows = [...contactMap.values()]
      const activeConvs = convs.filter(c => c.status === 'open').length
      const totalDeals = rows.reduce((s, r) => s + r.openDeals, 0)

      // Approximate average response time from agent messages this week
      const { data: agentMsgs } = await db
        .from('messages')
        .select('conversation_id, created_at')
        .eq('sender_type', 'agent')
        .eq('sender_id', user.id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(500)

      let avgResponseMin: number | null = null
      if (agentMsgs && agentMsgs.length >= 2) {
        const byConv: Record<string, string[]> = {}
        for (const m of agentMsgs) {
          if (!byConv[m.conversation_id]) byConv[m.conversation_id] = []
          byConv[m.conversation_id].push(m.created_at)
        }
        const diffs: number[] = []
        for (const times of Object.values(byConv)) {
          for (let i = 1; i < times.length; i++) {
            const diff = (new Date(times[i]).getTime() - new Date(times[i - 1]).getTime()) / 60000
            if (diff > 0 && diff < 60) diffs.push(diff)
          }
        }
        if (diffs.length > 0) {
          avgResponseMin = Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length)
        }
      }

      setSummary({ totalClients: rows.length, activeConversations: activeConvs, openDeals: totalDeals, avgResponseMin })
      setClients(rows)
      setLoading(false)
    })()
  }, [user?.id, profileLoading])

  const filtered = clients.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.lastMessageText?.toLowerCase().includes(q)
    )
  })

  if (loading || profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumo dos clientes que você atende diretamente.
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard icon={Users} color="blue" label="Clientes" value={String(summary.totalClients)} />
          <SummaryCard icon={MessageSquare} color="violet" label="Conversas ativas" value={String(summary.activeConversations)} />
          <SummaryCard icon={GitBranch} color="emerald" label="Casos em aberto" value={String(summary.openDeals)} />
          <SummaryCard
            icon={Clock}
            color="orange"
            label="Tempo méd. resposta"
            value={summary.avgResponseMin !== null ? `${summary.avgResponseMin}m` : '—'}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone..."
          className="w-full rounded-lg border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Client table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {clients.length === 0
              ? 'Você ainda não tem conversas atribuídas.'
              : 'Nenhum cliente encontrado para essa busca.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cliente
                </th>
                <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                  Última mensagem
                </th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Casos abertos
                </th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.contact_id} className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(c.name || c.phone).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{c.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 sm:table-cell">
                    <p className="max-w-xs truncate text-muted-foreground">
                      {c.lastMessageText || '—'}
                    </p>
                    {c.lastMessageAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground/60">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={cn(
                      'font-semibold',
                      c.openDeals > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {c.openDeals}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={c.conversationStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const COLORS = {
  blue:    'bg-blue-500/15 text-blue-400',
  violet:  'bg-violet-500/15 text-violet-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  orange:  'bg-orange-500/15 text-orange-400',
}

function SummaryCard({
  icon: Icon, color, label, value,
}: {
  icon: typeof Users
  color: keyof typeof COLORS
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${COLORS[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tabular-nums text-foreground">{value}</p>
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  open:    { label: 'Aberta',    className: 'bg-primary/10 text-primary border-primary/30' },
  pending: { label: 'Pendente',  className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  closed:  { label: 'Fechada',   className: 'bg-muted text-muted-foreground border-border' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.closed
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { MessageSquare, Send, TrendingUp, ChevronDown, Check, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OperatorRow {
  user_id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  account_role: string
  activeConversations: number
  messagesToday: number
  avgResponseMin: number | null
}

export default function EquipePage() {
  const { accountRole, accountId, profileLoading, user } = useAuth()
  const router = useRouter()
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const canManage = accountRole === 'owner' || accountRole === 'admin'
  const callerIsAdmin = accountRole === 'admin'
  const isOwner = accountRole === 'owner'

  // null = not yet initialized; set once profile loads
  const [operatorFilter, setOperatorFilter] = useState<string | null>(null)

  // Default: admin sees their own data; owner sees the whole team
  useEffect(() => {
    if (profileLoading || operatorFilter !== null) return
    setOperatorFilter(isOwner ? '' : (user?.id ?? ''))
  }, [profileLoading, isOwner, user?.id, operatorFilter])

  async function handleRemoveMember(op: OperatorRow) {
    const label = op.full_name ?? op.email ?? 'este membro'
    if (!confirm(`Remover ${label} da equipe? Ele perderá o acesso ao CRM.`)) return
    setRemovingId(op.user_id)
    const res = await fetch(`/api/team/members/${op.user_id}`, { method: 'DELETE' })
    setRemovingId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Falha ao remover membro')
      return
    }
    setOperators(prev => prev.filter(o => o.user_id !== op.user_id))
    toast.success(`${label} removido da equipe`)
  }

  async function handleRoleChange(operatorUserId: string, newRole: string) {
    // Owners can change anyone (including themselves and other owners).
    // Admins cannot change their own role, cannot touch owners, cannot promote to owner.
    if (accountRole !== 'owner') {
      if (operatorUserId === user?.id) {
        toast.error('Você não pode alterar sua própria função')
        return
      }
      const target = operators.find(o => o.user_id === operatorUserId)
      if (target?.account_role === 'owner') {
        toast.error('A função de um proprietário não pode ser alterada')
        return
      }
      if (newRole === 'owner') {
        toast.error('Não é permitido promover alguém a Proprietário por aqui')
        return
      }
    }
    setSavingRole(operatorUserId)
    const db = createClient()
    const { error } = await db
      .from('profiles')
      .update({ account_role: newRole })
      .eq('user_id', operatorUserId)
    setSavingRole(null)
    if (error) {
      toast.error('Falha ao atualizar função')
      return
    }
    setOperators(prev =>
      prev.map(op => op.user_id === operatorUserId ? { ...op, account_role: newRole } : op)
    )
    toast.success('Função atualizada')
  }

  // Only admin and owner can view team analytics
  useEffect(() => {
    if (profileLoading) return
    if (accountRole !== 'admin' && accountRole !== 'owner') {
      router.replace('/inbox')
    }
  }, [accountRole, profileLoading, router])

  useEffect(() => {
    if (profileLoading || !accountId) return
    if (accountRole !== 'admin' && accountRole !== 'owner') return

    const db = createClient()

    ;(async () => {
      setLoading(true)

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [profilesRes, convsRes, msgsRes, responsesRes] = await Promise.all([
        db.from('profiles')
          .select('user_id, full_name, email, avatar_url, account_role')
          .eq('account_id', accountId)
          .order('full_name'),

        db.from('conversations')
          .select('assigned_agent_id')
          .eq('status', 'open'),

        db.from('messages')
          .select('sender_id')
          .in('sender_type', ['agent', 'bot'])
          .eq('is_note', false)
          .gte('created_at', todayStart.toISOString()),

        // First-response time: messages from agents after a customer message
        db.from('messages')
          .select('sender_id, conversation_id, created_at')
          .eq('sender_type', 'agent')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })
          .limit(2000),
      ])

      const profiles = profilesRes.data ?? []
      const convs = convsRes.data ?? []
      const msgs = msgsRes.data ?? []

      // Count active conversations per agent
      const convByAgent: Record<string, number> = {}
      for (const c of convs) {
        if (c.assigned_agent_id) {
          convByAgent[c.assigned_agent_id] = (convByAgent[c.assigned_agent_id] ?? 0) + 1
        }
      }

      // Count messages sent today per agent
      const msgByAgent: Record<string, number> = {}
      for (const m of msgs) {
        if (m.sender_id) {
          msgByAgent[m.sender_id] = (msgByAgent[m.sender_id] ?? 0) + 1
        }
      }

      // Average response time (minutes) per agent — approximate from agent messages this week
      const agentMsgs = responsesRes.data ?? []
      const responseSumByAgent: Record<string, number> = {}
      const responseCountByAgent: Record<string, number> = {}
      // Group agent messages by conversation, look at gaps as proxy
      const byConv: Record<string, typeof agentMsgs> = {}
      for (const m of agentMsgs) {
        if (!byConv[m.conversation_id]) byConv[m.conversation_id] = []
        byConv[m.conversation_id].push(m)
      }
      for (const msgs of Object.values(byConv)) {
        if (msgs.length < 2) continue
        for (let i = 1; i < msgs.length; i++) {
          const prev = new Date(msgs[i - 1].created_at).getTime()
          const curr = new Date(msgs[i].created_at).getTime()
          const diffMin = (curr - prev) / 60000
          if (diffMin > 0 && diffMin < 60) {
            const agentId = msgs[i].sender_id
            if (agentId) {
              responseSumByAgent[agentId] = (responseSumByAgent[agentId] ?? 0) + diffMin
              responseCountByAgent[agentId] = (responseCountByAgent[agentId] ?? 0) + 1
            }
          }
        }
      }

      const rows: OperatorRow[] = profiles.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url ?? null,
        account_role: p.account_role ?? 'agent',
        activeConversations: convByAgent[p.user_id] ?? 0,
        messagesToday: msgByAgent[p.user_id] ?? 0,
        avgResponseMin: responseCountByAgent[p.user_id]
          ? Math.round(responseSumByAgent[p.user_id] / responseCountByAgent[p.user_id])
          : null,
      }))

      setOperators(rows)
      setLoading(false)
    })()
  }, [accountId, accountRole, profileLoading])

  if (profileLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const effectiveFilter = operatorFilter ?? ''
  const displayOp = effectiveFilter ? (operators.find(o => o.user_id === effectiveFilter) ?? null) : null
  const totalActive = displayOp ? displayOp.activeConversations : operators.reduce((s, o) => s + o.activeConversations, 0)
  const totalMsgs = displayOp ? displayOp.messagesToday : operators.reduce((s, o) => s + o.messagesToday, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desempenho dos operadores em tempo real.
          </p>
        </div>
        {canManage && operators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <select
              value={effectiveFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isOwner
                ? <option value="">Toda a equipe</option>
                : <option value={user?.id ?? ''}>Meus dados</option>
              }
              {operators
                .filter(o => isOwner || o.user_id !== user?.id)
                .map(o => (
                  <option key={o.user_id} value={o.user_id}>{o.full_name ?? o.email}</option>
                ))
              }
            </select>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={TrendingUp}
          color="blue"
          label="Operadores na equipe"
          value={String(operators.length)}
        />
        <SummaryCard
          icon={MessageSquare}
          color="violet"
          label={displayOp ? 'Conversas abertas' : 'Conversas abertas (equipe)'}
          value={String(totalActive)}
        />
        <SummaryCard
          icon={Send}
          color="emerald"
          label={displayOp ? 'Mensagens enviadas hoje' : 'Mensagens enviadas hoje (equipe)'}
          value={String(totalMsgs)}
        />
      </div>

      {/* Operator table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Operador
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Conversas ativas
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mensagens hoje
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tempo médio resp.
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Função
              </th>
              {canManage && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {operators.map((op) => (
              <tr key={op.user_id} className="hover:bg-muted/30">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary overflow-hidden">
                      {op.avatar_url ? (
                        <img src={op.avatar_url} alt={op.full_name ?? 'avatar'} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        (op.full_name || op.email || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{op.full_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{op.email ?? ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={op.activeConversations > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {op.activeConversations}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={op.messagesToday > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {op.messagesToday}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  {op.avgResponseMin !== null ? (
                    <span className={`font-semibold ${op.avgResponseMin > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {op.avgResponseMin}m
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {(op.user_id === user?.id || op.account_role === 'owner') && accountRole !== 'owner' ? (
                    <RoleChip role={op.account_role} />
                  ) : (
                    <RoleSelect
                      role={op.account_role}
                      disabled={savingRole === op.user_id}
                      onChange={v => handleRoleChange(op.user_id, v)}
                      callerIsOwner={accountRole === 'owner'}
                    />
                  )}
                </td>
                {canManage && (
                  <td className="px-5 py-4 text-right">
                    {op.user_id !== user?.id && !(callerIsAdmin && (op.account_role === 'admin' || op.account_role === 'owner')) && (
                      <button
                        onClick={() => handleRemoveMember(op)}
                        disabled={removingId === op.user_id}
                        title="Remover da equipe"
                        className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        {removingId === op.user_id
                          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-t-transparent border-red-400" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {operators.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Nenhum operador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const COLOR_MAP = {
  blue:    'bg-blue-500/15 text-blue-400',
  violet:  'bg-violet-500/15 text-violet-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
}

function SummaryCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof MessageSquare
  color: keyof typeof COLOR_MAP
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${COLOR_MAP[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tabular-nums text-foreground">{value}</p>
    </div>
  )
}

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  owner:  { label: 'Proprietário', className: 'border-amber-500 bg-amber-500 text-white' },
  admin:  { label: 'Admin',        className: 'border-primary bg-primary text-primary-foreground' },
  agent:  { label: 'Operador',      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  viewer: { label: 'Visualizador', className: 'border-slate-400 bg-slate-400 text-white' },
}

function RoleChip({ role }: { role: string }) {
  const meta = ROLE_LABELS[role] ?? ROLE_LABELS.agent
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

const ROLE_OPTIONS_ADMIN = [
  { value: 'admin',  label: 'Admin' },
  { value: 'agent',  label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
]

const ROLE_OPTIONS_OWNER = [
  { value: 'owner',  label: 'Proprietário' },
  { value: 'admin',  label: 'Admin' },
  { value: 'agent',  label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
]

function RoleSelect({ role, disabled, onChange, callerIsOwner }: {
  role: string
  disabled: boolean
  onChange: (v: string) => void
  callerIsOwner?: boolean
}) {
  const meta = ROLE_LABELS[role] ?? ROLE_LABELS.agent
  const options = callerIsOwner ? ROLE_OPTIONS_OWNER : ROLE_OPTIONS_ADMIN
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80 focus:outline-none disabled:cursor-wait disabled:opacity-50 ${meta.className}`}
      >
        {disabled ? (
          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36 border-border bg-popover">
        {options.map(o => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex items-center justify-between text-sm text-popover-foreground focus:bg-muted"
          >
            {o.label}
            {o.value === role && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

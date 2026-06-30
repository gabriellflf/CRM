"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { QuickActions } from './quick-actions'
import { ResponseTimeChart } from './response-time-chart'
import {
  loadResponseTime,
  loadAvgResponseTime,
  loadConversationsSeries,
} from '@/lib/dashboard/queries'
import type { ResponseTimeSummary, ConversationsSeriesPoint } from '@/lib/dashboard/types'

interface MyConversation {
  id: string
  status: string
  last_message_at: string | null
  last_message_text: string | null
  unread_count: number
  contact_name: string | null
  contact_phone: string | null
}

interface MyStats {
  open: number
  pending: number
  closedToday: number
  messagesSentToday: number
}

export function OperatorDashboard() {
  const { user, profile } = useAuth()
  const [conversations, setConversations] = useState<MyConversation[]>([])
  const [stats, setStats] = useState<MyStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)
  const [avgResponseTime, setAvgResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [avgResponseTimeLoading, setAvgResponseTimeLoading] = useState(true)
  const [weeklySeries, setWeeklySeries] = useState<ConversationsSeriesPoint[] | null>(null)
  const [weeklyLoading, setWeeklyLoading] = useState(true)

  const loadData = useCallback(async (userId: string) => {
    const db = createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [convsRes, closedRes, msgsRes] = await Promise.all([
      db.from('conversations')
        .select('id, status, last_message_at, last_message_text, unread_count, contact:contacts(name, phone)')
        .eq('assigned_agent_id', userId)
        .in('status', ['open', 'pending'])
        .order('last_message_at', { ascending: false })
        .limit(20),
      db.from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', userId)
        .eq('status', 'closed')
        .gte('updated_at', todayStart.toISOString()),
      db.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)
        .eq('sender_type', 'agent')
        .eq('is_note', false)
        .gte('created_at', todayStart.toISOString()),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convRows: MyConversation[] = (convsRes.data ?? []).map((c: any) => ({
      id: c.id,
      status: c.status,
      last_message_at: c.last_message_at,
      last_message_text: c.last_message_text,
      unread_count: c.unread_count ?? 0,
      contact_name: c.contact?.name ?? null,
      contact_phone: c.contact?.phone ?? null,
    }))

    setConversations(convRows)
    setStats({
      open: convRows.filter((c) => c.status === 'open').length,
      pending: convRows.filter((c) => c.status === 'pending').length,
      closedToday: closedRes.count ?? 0,
      messagesSentToday: msgsRes.count ?? 0,
    })
    setLoading(false)

    // Load performance charts in parallel
    loadResponseTime(db, userId)
      .then(setResponseTime)
      .catch(() => null)
      .finally(() => setResponseTimeLoading(false))

    loadAvgResponseTime(db, userId)
      .then(setAvgResponseTime)
      .catch(() => null)
      .finally(() => setAvgResponseTimeLoading(false))

    loadConversationsSeries(db, 7, userId)
      .then(setWeeklySeries)
      .catch(() => null)
      .finally(() => setWeeklyLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    loadData(user.id)
  }, [user?.id, loadData])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Operador'
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Olá, {firstName}</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{today}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Conversas abertas"
          value={loading ? '—' : String(stats?.open ?? 0)}
          icon={MessageSquare}
          status={
            !loading && (stats?.open ?? 0) >= 8
              ? 'alert'
              : !loading && (stats?.open ?? 0) >= 4
                ? 'warn'
                : 'ok'
          }
        />
        <StatCard
          label="Pendentes"
          value={loading ? '—' : String(stats?.pending ?? 0)}
          icon={Clock}
          status={!loading && (stats?.pending ?? 0) > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          label="Fechadas hoje"
          value={loading ? '—' : String(stats?.closedToday ?? 0)}
          icon={CheckCircle2}
          status="neutral"
        />
        <StatCard
          label="Mensagens enviadas"
          value={loading ? '—' : String(stats?.messagesSentToday ?? 0)}
          icon={Send}
          status="neutral"
        />
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Performance: SLA charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ResponseTimeChart
          data={responseTime}
          loading={responseTimeLoading}
          title="Tempo de Primeira Resposta"
          subtitle="Quantos minutos você levou para responder pela primeira vez, por dia"
          thresholdMinutes={5}
        />
        <ResponseTimeChart
          data={avgResponseTime}
          loading={avgResponseTimeLoading}
          title="Tempo Médio de Resposta"
          subtitle="Tempo médio entre sua resposta e a mensagem do cliente, por dia"
          thresholdMinutes={10}
        />
      </div>

      {/* Weekly volume */}
      <WeeklyVolumeCard data={weeklySeries} loading={weeklyLoading} />

      {/* My open conversations */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="text-sm font-semibold text-foreground">Minhas conversas abertas</p>
          <Link
            href="/inbox"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver todas
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
            <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhuma conversa aberta atribuída a você.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <Link
                  href="/inbox"
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      conv.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {conv.contact_name ?? conv.contact_phone ?? 'Desconhecido'}
                      </span>
                      {conv.status === 'pending' && (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                          Pendente
                        </span>
                      )}
                      {conv.unread_count > 0 && (
                        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {conv.last_message_text ?? 'Sem mensagens recentes'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {conv.last_message_at
                      ? formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: false,
                          locale: ptBR,
                        })
                      : ''}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Weekly Volume Card ────────────────────────────────────────────────────

function WeeklyVolumeCard({
  data,
  loading,
}: {
  data: ConversationsSeriesPoint[] | null
  loading: boolean
}) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  const maxOutgoing = data
    ? Math.max(...data.map((d) => d.outgoing), 1)
    : 1

  const totalOutgoing = data?.reduce((s, d) => s + d.outgoing, 0) ?? 0
  const totalIncoming = data?.reduce((s, d) => s + d.incoming, 0) ?? 0

  return (
    <section className="w-full overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Volume desta semana</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Conversas recebidas e mensagens enviadas por dia
          </p>
        </div>
        {!loading && data && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{totalIncoming}</span> recebidas
            </span>
            <span>
              <span className="font-semibold tabular-nums text-primary">{totalOutgoing}</span> enviadas
            </span>
          </div>
        )}
      </header>

      <div className="p-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !data || data.every((d) => d.outgoing === 0 && d.incoming === 0) ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1">
            <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Sem atividade registrada esta semana</p>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1.5 h-32">
            {data.map((point, i) => {
              const outPct = maxOutgoing > 0 ? (point.outgoing / maxOutgoing) * 100 : 0
              const inPct  = maxOutgoing > 0 ? (point.incoming  / maxOutgoing) * 100 : 0
              return (
                <div key={i} className="group flex flex-1 flex-col items-center gap-1">
                  {/* Bar group */}
                  <div className="relative flex w-full items-end justify-center gap-0.5" style={{ height: '96px' }}>
                    {/* Incoming bar */}
                    <div
                      title={`${point.incoming} recebidas`}
                      className="w-[40%] rounded-t bg-muted transition-all"
                      style={{ height: `${Math.max(inPct, point.incoming > 0 ? 4 : 0)}%` }}
                    />
                    {/* Outgoing bar */}
                    <div
                      title={`${point.outgoing} enviadas`}
                      className="w-[40%] rounded-t bg-primary/70 transition-all"
                      style={{ height: `${Math.max(outPct, point.outgoing > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  {/* Day label */}
                  <span className="text-[10px] text-muted-foreground">{days[i]}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-muted" />
            Recebidas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/70" />
            Enviadas
          </span>
        </div>
      </div>
    </section>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

type StatStatus = 'ok' | 'warn' | 'alert' | 'neutral'

const STAT_COLORS: Record<StatStatus, { icon: string; value: string }> = {
  ok:      { icon: 'bg-emerald-500/10 text-emerald-400', value: 'text-foreground' },
  warn:    { icon: 'bg-amber-500/10 text-amber-400',     value: 'text-amber-400' },
  alert:   { icon: 'bg-red-500/10 text-red-400',         value: 'text-red-400' },
  neutral: { icon: 'bg-muted text-muted-foreground',     value: 'text-foreground' },
}

function StatCard({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string
  value: string
  icon: typeof MessageSquare
  status: StatStatus
}) {
  const colors = STAT_COLORS[status]
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colors.icon}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${colors.value}`}>{value}</p>
    </div>
  )
}

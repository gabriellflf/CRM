"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { ConversationsSeriesPoint } from '@/lib/dashboard/types'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type RangeDays = 7 | 30 | 90

interface ConversationsChartProps {
  /** Per-range data, so switching tabs never re-fetches. */
  series: Record<RangeDays, ConversationsSeriesPoint[] | null>
  loading: boolean
  range: RangeDays
  onRangeChange: (r: RangeDays) => void
}

// ------------------------------------------------------------
// Layout constants. The SVG renders into a fixed viewBox and scales
// via CSS (preserveAspectRatio default). Everything inside uses
// viewBox coordinates so the drawing math stays simple even as the
// container resizes.
// ------------------------------------------------------------
const VB_W = 760
const VB_H = 240
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 }

// ------------------------------------------------------------
// Day detail modal types
// ------------------------------------------------------------
interface DayConvo {
  id: string
  status: string
  contactName: string
  contactPhone: string
  incoming: number
  outgoing: number
}

export function ConversationsChart({ series, loading, range, onRangeChange }: ConversationsChartProps) {
  const data = series[range]
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Memoise the max so per-day hover math doesn't recompute it.
  const { maxY, niceTicks } = useMemo(() => {
    const arr = data ?? []
    const max = arr.reduce(
      (m, p) => Math.max(m, p.incoming, p.outgoing),
      0,
    )
    const ceil = niceCeil(max)
    const ticks = [0, ceil / 4, ceil / 2, (3 * ceil) / 4, ceil].map((v) =>
      Math.round(v),
    )
    // De-dupe when the series is flat 0.
    return { maxY: ceil, niceTicks: Array.from(new Set(ticks)) }
  }, [data])

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conversas ao Longo do Tempo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Volume diário de mensagens por direção · clique num ponto para ver detalhes</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
          {[7, 30, 90].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r as RangeDays)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                range === r
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r} dias
            </button>
          ))}
        </div>
      </header>

      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-[240px] w-full" />
        ) : data.every((p) => p.incoming === 0 && p.outgoing === 0) ? (
          <EmptyState
            icon={MessageSquare}
            title="Sem atividade de mensagens neste período"
            hint="Envie ou receba mensagens para preencher este gráfico."
          />
        ) : (
          <LineSvg data={data} maxY={maxY} ticks={niceTicks} onDayClick={setSelectedDay} />
        )}
      </div>

      <footer className="flex items-center gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <LegendDot color="#3b82f6" label="Recebidas" />
        <LegendDot color="#7c3aed" label="Enviadas" />
      </footer>

      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </section>
  )
}

// ------------------------------------------------------------
// The actual SVG. Two polylines + per-day hit targets for hover.
// ------------------------------------------------------------

function LineSvg({
  data,
  maxY,
  ticks,
  onDayClick,
}: {
  data: ConversationsSeriesPoint[]
  maxY: number
  ticks: number[]
  onDayClick: (day: string) => void
}) {
  // Hover state: both the snapped index AND the tooltip's pixel
  // offset inside the wrapper div. They're stored together so the
  // tooltip positions against the chart's actual rendered pixels,
  // not against a raw viewBox percentage. See the precision note on
  // the onMove handler below.
  const [hover, setHover] = useState<{ idx: number; tooltipLeftPx: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const chartW = VB_W - PADDING.left - PADDING.right
  const chartH = VB_H - PADDING.top - PADDING.bottom

  // x step can be fractional for 90-day views; points are positioned
  // at the center of each "slot" so the first and last points don't
  // sit right on the axis.
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0
  const yFor = (v: number) =>
    maxY === 0 ? PADDING.top + chartH : PADDING.top + chartH - (v / maxY) * chartH
  const xFor = (i: number) => PADDING.left + i * stepX

  const incomingPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.incoming)}`).join(' ')
  const outgoingPath = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.outgoing)}`).join(' ')

  // Resolve viewBox x → snapped data index, returning null if outside chart area.
  const resolveIdx = (clientX: number, svg: SVGSVGElement): number | null => {
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = 0
    const local = pt.matrixTransform(ctm.inverse())
    const xVb = local.x
    if (xVb < PADDING.left - 8 || xVb > VB_W - PADDING.right + 8) return null
    const relative = xVb - PADDING.left
    return Math.max(0, Math.min(data.length - 1, Math.round(stepX === 0 ? 0 : relative / stepX)))
  }

  // Mouse-move: use the SVG's current screen-CTM to map clientX
  // back to viewBox coordinates. The previous rect-based math
  // assumed the viewBox filled the SVG DOM box linearly, but
  // `preserveAspectRatio="xMidYMid meet"` (the SVG default)
  // letterboxes the content horizontally when the container is
  // wider than the viewBox aspect — so hover snapped hundreds of
  // pixels off on wide layouts. CTM-inverse correctly accounts for
  // letterboxing, scaling, and any future transform changes.
  useEffect(() => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return

    const onMove = (e: MouseEvent) => {
      const idx = resolveIdx(e.clientX, svg)
      if (idx === null) { setHover(null); return }
      const ctm = svg.getScreenCTM()!
      const dataPointVbX = PADDING.left + idx * stepX
      const dataPointPt = svg.createSVGPoint()
      dataPointPt.x = dataPointVbX
      dataPointPt.y = 0
      const screen = dataPointPt.matrixTransform(ctm)
      const wrapRect = wrap.getBoundingClientRect()
      setHover({ idx, tooltipLeftPx: screen.x - wrapRect.left })
    }

    const onLeave = () => setHover(null)

    const onClick = (e: MouseEvent) => {
      const idx = resolveIdx(e.clientX, svg)
      if (idx === null) return
      onDayClick(data[idx].day)
    }

    svg.addEventListener('mousemove', onMove)
    svg.addEventListener('mouseleave', onLeave)
    svg.addEventListener('click', onClick)
    return () => {
      svg.removeEventListener('mousemove', onMove)
      svg.removeEventListener('mouseleave', onLeave)
      svg.removeEventListener('click', onClick)
    }
    // xFor + yFor close over stepX, so stepX covers them.
  }, [data, stepX, onDayClick])

  const hovered = hover !== null ? data[hover.idx] : null
  const hoverX = hover !== null ? xFor(hover.idx) : 0

  // X-axis label strategy: show ~6 evenly-spaced labels regardless
  // of range so the axis never looks crowded.
  const labelStride = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-[240px] w-full cursor-pointer"
        role="img"
        aria-label="Conversas por dia — clique num ponto para ver detalhes"
      >
        {/* Y-axis gridlines + labels */}
        {ticks.map((t) => {
          const y = yFor(t)
          return (
            <g key={t}>
              <line
                x1={PADDING.left}
                x2={VB_W - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={PADDING.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {data.map((p, i) =>
          i % labelStride === 0 ? (
            <text
              key={p.day}
              x={xFor(i)}
              y={VB_H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {shortDayLabel(p.day)}
            </text>
          ) : null,
        )}

        {/* Outgoing polyline (violet) */}
        <path
          d={outgoingPath}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Incoming polyline (blue) */}
        <path
          d={incomingPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover crosshair */}
        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={PADDING.top + chartH}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
            <circle cx={hoverX} cy={yFor(data[hover.idx].incoming)} r={5} fill="#3b82f6" />
            <circle cx={hoverX} cy={yFor(data[hover.idx].outgoing)} r={5} fill="#7c3aed" />
          </g>
        )}
      </svg>

      {/* Tooltip — absolute-positioned div so we get crisp text, not
          SVG-rendered text. The left offset comes from the CTM-based
          mapping so it lines up with the actual crosshair pixel, not a
          letterboxed viewBox percentage. */}
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${hover.tooltipLeftPx}px` }}
        >
          <div className="font-medium text-popover-foreground">{longDayLabel(hovered.day)}</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              {hovered.incoming} recebidas
            </span>
            <span className="flex items-center gap-1.5 text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {hovered.outgoing} enviadas
            </span>
          </div>
          <div className="mt-1.5 border-t border-border pt-1 text-[10px] text-muted-foreground">
            Clique para ver conversas
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Modal that shows conversations with activity on a given day
// ------------------------------------------------------------

function DayDetailModal({ day, onClose }: { day: string; onClose: () => void }) {
  const [rows, setRows] = useState<DayConvo[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const [y, m, d] = day.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const end = new Date(y, m - 1, d + 1)

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, sender_type')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())

      if (!msgs || msgs.length === 0) {
        setRows([])
        return
      }

      // Group message counts by conversation
      const countMap = new Map<string, { incoming: number; outgoing: number }>()
      for (const msg of msgs) {
        const entry = countMap.get(msg.conversation_id) ?? { incoming: 0, outgoing: 0 }
        if (msg.sender_type === 'customer') entry.incoming++
        else entry.outgoing++
        countMap.set(msg.conversation_id, entry)
      }

      const ids = [...countMap.keys()]
      const { data: convos } = await supabase
        .from('conversations')
        .select('id, status, contacts(name, phone)')
        .in('id', ids)

      if (!convos) {
        setRows([])
        return
      }

      setRows(
        convos.map((c) => {
          const contact = Array.isArray(c.contacts) ? c.contacts[0] : c.contacts
          const counts = countMap.get(c.id) ?? { incoming: 0, outgoing: 0 }
          return {
            id: c.id,
            status: c.status ?? 'open',
            contactName: (contact as { name?: string } | null)?.name ?? '',
            contactPhone: (contact as { phone?: string } | null)?.phone ?? '',
            incoming: counts.incoming,
            outgoing: counts.outgoing,
          }
        }),
      )
    })()
  }, [day])

  const statusLabel: Record<string, string> = {
    open: 'Aberto',
    pending: 'Pendente',
    closed: 'Fechado',
  }
  const statusClass: Record<string, string> = {
    open: 'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-400',
    closed: 'bg-muted text-muted-foreground',
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{longDayLabel(day)}</DialogTitle>
          <DialogDescription>
            Conversas com atividade neste dia
          </DialogDescription>
        </DialogHeader>

        {rows === null ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada neste dia.
          </p>
        ) : (
          <ul className="max-h-[400px] divide-y divide-border overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.contactName || row.contactPhone || 'Contato desconhecido'}
                  </p>
                  {row.contactName && (
                    <p className="text-xs text-muted-foreground">{row.contactPhone}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {row.incoming} recebidas
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      {row.outgoing} enviadas
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    statusClass[row.status] ?? statusClass.open,
                  )}
                >
                  {statusLabel[row.status] ?? row.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function shortDayLabel(key: string): string {
  // key is YYYY-MM-DD; return "Apr 17"-style. Using Date with an
  // appended time avoids timezone-shift surprises across midnight.
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
}

function longDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('pt-BR', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Round `max` up to a "nice" number so Y-axis ticks feel natural
 * (1, 2, 5, 10, 20, 50, …). Keeps the chart readable even when the
 * series is small (max=3 becomes ceil=4, not 3).
 */
function niceCeil(max: number): number {
  if (max <= 0) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const normalised = max / pow
  let nice: number
  if (normalised <= 1) nice = 1
  else if (normalised <= 2) nice = 2
  else if (normalised <= 5) nice = 5
  else nice = 10
  return nice * pow
}

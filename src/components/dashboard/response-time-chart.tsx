"use client"

import { Clock } from 'lucide-react'
import { DOW_SHORT_MON_FIRST } from '@/lib/dashboard/date-utils'
import type { ResponseTimeSummary } from '@/lib/dashboard/types'
import { BarChart, type TooltipProps } from '@/components/tremor/bar-chart'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'

interface ResponseTimeChartProps {
  data: ResponseTimeSummary | null
  loading: boolean
  thresholdMinutes?: number
  title?: string
  subtitle?: string
}

// Single category, single colour — the data is "average minutes
// per weekday". Tremor expects categories as the second tuple in
// the row object, so we shape the buckets into
// `{ day: 'Mon', 'Avg minutes': 4.2 }` rows below.
const CATEGORY = 'Avg minutes'

export function ResponseTimeChart({
  data,
  loading,
  thresholdMinutes = 5,
  title = 'Tempo Médio de Primeira Resposta',
  subtitle = 'Minutos para responder a primeira mensagem do cliente, por dia da semana',
}: ResponseTimeChartProps) {
  const hasData = data?.buckets.some((b) => b.avgMinutes != null) ?? false

  // Map buckets → Tremor rows. Null `avgMinutes` (no samples)
  // collapses to 0; the chart will render an empty slot for it.
  // We attach `samples` on the row so a future customTooltip can
  // surface "no samples" copy without losing the data shape.
  const displayMax = thresholdMinutes * 3

  const chartData =
    data?.buckets.map((b, i) => ({
      day: DOW_SHORT_MON_FIRST[i],
      [CATEGORY]: Math.min(b.avgMinutes ?? 0, displayMax),
      actualMinutes: b.avgMinutes ?? 0,
      threshold: thresholdMinutes,
      samples: b.samples,
    })) ?? []

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-right text-xs">
          {thresholdMinutes > 0 && (
            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-medium text-rose-300 tabular-nums">
              meta {thresholdMinutes}m
            </span>
          )}
          {data && (data.thisWeekAvg != null || data.lastWeekAvg != null) && (
            <div>
              <div className="text-muted-foreground">
                Esta semana:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {fmt(data.thisWeekAvg)}
                </span>
              </div>
              <div className="text-muted-foreground">
                Semana passada:{' '}
                <span className="tabular-nums">{fmt(data.lastWeekAvg)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !hasData ? (
          <EmptyState
            icon={Clock}
            title="Sem respostas registradas ainda"
            hint="Este gráfico é preenchido conforme você responde às mensagens dos clientes."
          />
        ) : (
          <BarChart
            data={chartData}
            index="day"
            categories={[CATEGORY]}
            // 'violet' maps to Tailwind's `fill-violet-500` — matches
            // the brand accent the hand-rolled bars used (#7c3aed).
            colors={['violet']}
            valueFormatter={(value) => `${value.toFixed(1)}m`}
            customTooltip={ResponseTimeTooltip}
            showLegend={false}
            layout="vertical"
            maxValue={displayMax}
            referenceLineX={thresholdMinutes}
            xAxisTicks={Array.from({ length: thresholdMinutes + 1 }, (_, i) => i)}
            yAxisWidth={44}
            // Compact height so the chart sits well inside the card
            // without dominating the row alongside the donut + activity feed.
            className="h-[260px]"
          />
        )}
      </div>
    </section>
  )
}

function ResponseTimeTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as { actualMinutes: number; samples: number }
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
        <span className="text-muted-foreground">Tempo médio:</span>
        <span className="font-medium text-popover-foreground tabular-nums">
          {fmt(row.actualMinutes)}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        {row.samples === 0 ? 'Sem interações' : `${row.samples} resposta${row.samples === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}

function fmt(mins: number | null): string {
  if (mins == null) return '—'
  if (mins === 0) return '0m'
  if (mins < 1) return `${Math.round(mins * 60)}s`
  if (mins < 60) return `${mins.toFixed(1)}m`
  return `${(mins / 60).toFixed(1)}h`
}

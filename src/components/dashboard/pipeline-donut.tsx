"use client"

import { useState } from 'react'
import { GitBranch, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PipelineDonutData, PipelineStageSlice } from '@/lib/dashboard/types'
import type { Deal } from '@/types'
import { formatCurrencyShort, formatCurrency } from '@/lib/currency'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface PipelineDonutProps {
  data: PipelineDonutData | null
  loading: boolean
  currency: string
}

export function PipelineDonut({ data, loading, currency }: PipelineDonutProps) {
  const [selectedStage, setSelectedStage] = useState<PipelineStageSlice | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [dealsLoading, setDealsLoading] = useState(false)

  async function openStage(stage: PipelineStageSlice) {
    setSelectedStage(stage)
    setDeals([])
    setDealsLoading(true)
    try {
      const db = createClient()
      const { data: rows } = await db
        .from('deals')
        .select('*, contact:contacts(id, name, phone, company)')
        .eq('stage_id', stage.id)
        .eq('status', 'open')
        .order('value', { ascending: false })
      setDeals((rows as Deal[]) ?? [])
    } finally {
      setDealsLoading(false)
    }
  }

  return (
    <>
      <section className="flex h-full flex-col rounded-xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Valor do Pipeline</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Negócios abertos por etapa — clique para ver detalhes
          </p>
        </header>

        <div className="flex flex-1 flex-col p-5">
          {loading || !data ? (
            <Skeleton className="h-56 w-full" />
          ) : data.stages.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="Sem negócios abertos ainda"
              hint="Crie negócios em Pipelines para ver o detalhamento por etapa."
            />
          ) : (
            <>
              <Donut data={data} currency={currency} onStageClick={openStage} />
              <ul className="mt-5 space-y-2">
                {data.stages.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openStage(s)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/60"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ background: s.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-left text-muted-foreground">{s.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.dealCount} negócio{s.dealCount === 1 ? '' : 's'}
                      </span>
                      <span className="w-20 text-right text-muted-foreground tabular-nums">
                        {formatCurrencyShort(s.totalValue, currency)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <Dialog open={!!selectedStage} onOpenChange={(o) => { if (!o) setSelectedStage(null) }}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {selectedStage && (
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ background: selectedStage.color }}
                />
              )}
              <DialogTitle className="text-popover-foreground">
                {selectedStage?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground">
              {selectedStage?.dealCount ?? 0} negócio{(selectedStage?.dealCount ?? 0) === 1 ? '' : 's'} •{' '}
              {selectedStage && formatCurrencyShort(selectedStage.totalValue, currency)} em aberto
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            {dealsLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : deals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum negócio encontrado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {deals.map((deal) => (
                  <li key={deal.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-popover-foreground">
                          {deal.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs font-medium text-muted-foreground">Contato:</span>
                          <span className="truncate text-xs text-popover-foreground">
                            {deal.contact
                              ? [deal.contact.name, deal.contact.phone].filter(Boolean).join(' · ')
                              : '—'}
                          </span>
                        </div>
                        {deal.contact?.company && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {deal.contact.company}
                          </p>
                        )}
                        {deal.expected_close_date && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Previsão: {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(deal.value, currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ------------------------------------------------------------
// SVG ring — clicável por segmento
// ------------------------------------------------------------
function Donut({
  data,
  currency,
  onStageClick,
}: {
  data: PipelineDonutData
  currency: string
  onStageClick: (stage: PipelineStageSlice) => void
}) {
  const size = 200
  const r = 80
  const ringWidth = 18
  const cx = size / 2
  const cy = size / 2

  const totalRaw = data.totalValue || 1
  const minFrac = 0.02
  const rawShares = data.stages.map((s) => s.totalValue / totalRaw)
  const floored = rawShares.map((x) => Math.max(x, minFrac))
  const floorSum = floored.reduce((a, b) => a + b, 0)
  const shares = floored.map((x) => x / floorSum)

  const offsets: number[] = [0]
  for (let i = 0; i < shares.length; i++) offsets.push(offsets[i] + shares[i])
  const segments = data.stages.map((s, i) => {
    const start = offsets[i] * Math.PI * 2 - Math.PI / 2
    const end = offsets[i + 1] * Math.PI * 2 - Math.PI / 2
    return { path: arcPath(cx, cy, r, start, end), color: s.color, id: s.id, stage: s }
  })

  return (
    <div className="flex items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-48 w-48 cursor-pointer"
        role="img"
        aria-label="Valor do pipeline por etapa"
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={ringWidth} />
        {segments.map((seg, i) =>
          shares[i] >= 0.9999 ? (
            <circle
              key={seg.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={ringWidth}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onStageClick(seg.stage)}
            />
          ) : (
            <path
              key={seg.id}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={ringWidth}
              strokeLinecap="butt"
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onStageClick(seg.stage)}
            />
          ),
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          Total
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-foreground text-[18px] font-semibold tabular-nums">
          {formatCurrencyShort(data.totalValue, currency)}
        </text>
      </svg>
    </div>
  )
}

function arcPath(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endRad - startRad > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

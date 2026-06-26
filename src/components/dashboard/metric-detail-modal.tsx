"use client"

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import type {
  ActiveConversationRow,
  NewContactRow,
  OpenDealRow,
  MessageSentRow,
} from '@/lib/dashboard/queries'

type ModalKind = 'conversations' | 'contacts' | 'deals' | 'messages'

interface MetricDetailModalProps {
  kind: ModalKind | null
  loading: boolean
  conversations?: ActiveConversationRow[]
  contacts?: NewContactRow[]
  deals?: OpenDealRow[]
  messages?: MessageSentRow[]
  currency: string
  onClose: () => void
}

const TITLES: Record<ModalKind, string> = {
  conversations: 'Conversas Ativas',
  contacts: 'Novos Contatos Hoje',
  deals: 'Negócios Abertos',
  messages: 'Mensagens Enviadas Hoje',
}

export function MetricDetailModal({
  kind,
  loading,
  conversations,
  contacts,
  deals,
  messages,
  currency,
  onClose,
}: MetricDetailModalProps) {
  return (
    <Dialog open={!!kind} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {kind ? TITLES[kind] : ''}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {kind === 'conversations' && 'Todas as conversas abertas no momento'}
            {kind === 'contacts' && 'Contatos criados hoje'}
            {kind === 'deals' && 'Negócios com status aberto'}
            {kind === 'messages' && 'Mensagens enviadas pelos agentes hoje'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : kind === 'conversations' ? (
            <ConversationsList rows={conversations ?? []} />
          ) : kind === 'contacts' ? (
            <ContactsList rows={contacts ?? []} />
          ) : kind === 'deals' ? (
            <DealsList rows={deals ?? []} currency={currency} />
          ) : kind === 'messages' ? (
            <MessagesList rows={messages ?? []} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), "dd/MM 'às' HH:mm", { locale: ptBR })
}

function ConversationsList({ rows }: { rows: ActiveConversationRow[] }) {
  if (!rows.length) return <EmptyRow text="Nenhuma conversa ativa." />
  return (
    <ul className="divide-y divide-border">
      {rows.map((c) => (
        <li key={c.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-popover-foreground">
                {c.contact?.name || c.contact?.phone || '—'}
              </p>
              {c.contact?.name && (
                <p className="text-xs text-muted-foreground">{c.contact.phone}</p>
              )}
              {c.last_message_text && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.last_message_text}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {fmt(c.last_message_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ContactsList({ rows }: { rows: NewContactRow[] }) {
  if (!rows.length) return <EmptyRow text="Nenhum contato criado hoje." />
  return (
    <ul className="divide-y divide-border">
      {rows.map((c) => (
        <li key={c.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-popover-foreground">
                {c.name || c.phone}
              </p>
              {c.name && <p className="text-xs text-muted-foreground">{c.phone}</p>}
              {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {fmt(c.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DealsList({ rows, currency }: { rows: OpenDealRow[]; currency: string }) {
  if (!rows.length) return <EmptyRow text="Nenhum negócio aberto." />
  return (
    <ul className="divide-y divide-border">
      {rows.map((d) => (
        <li key={d.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-popover-foreground">{d.title}</p>
              {d.contact && (
                <p className="text-xs text-muted-foreground">
                  {[d.contact.name, d.contact.phone].filter(Boolean).join(' · ')}
                </p>
              )}
              {d.stage?.name && (
                <p className="text-xs text-muted-foreground">Etapa: {d.stage.name}</p>
              )}
              {d.expected_close_date && (
                <p className="text-xs text-muted-foreground">
                  Previsão: {format(new Date(d.expected_close_date), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(d.value ?? 0, currency)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function MessagesList({ rows }: { rows: MessageSentRow[] }) {
  if (!rows.length) return <EmptyRow text="Nenhuma mensagem enviada hoje." />
  return (
    <ul className="divide-y divide-border">
      {rows.map((m) => {
        const contact = m.conversation?.contact
        return (
          <li key={m.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-popover-foreground">
                  {contact?.name || contact?.phone || '—'}
                </p>
                {contact?.name && (
                  <p className="text-xs text-muted-foreground">{contact.phone}</p>
                )}
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {m.content_text || `[${m.content_type}]`}
                </p>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {fmt(m.created_at)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

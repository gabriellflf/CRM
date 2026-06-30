"use client"

import { useEffect, useState } from "react"
import { Bot, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { AgentForm } from "@/components/agents/agent-form"
import type { AiAgent } from "@/types"

export default function AgentsPage() {
  const [agents, setAgents] = useState<AiAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AiAgent | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const db = createClient()

  useEffect(() => {
    fetchAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAgents() {
    setLoading(true)
    const res = await fetch("/api/ai-agents")
    const data = await res.json()
    setAgents(data.agents ?? [])
    setLoading(false)
  }

  async function toggleActive(agent: AiAgent) {
    const next = !agent.is_active
    // Optimistic
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: next } : a))
    const res = await fetch(`/api/ai-agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, is_active: agent.is_active } : a))
      toast.error("Falha ao atualizar agente")
    }
  }

  async function deleteAgent(id: string) {
    if (!confirm("Tem certeza que deseja excluir este agente? As conversas atribuídas a ele serão desvinculadas.")) return
    setDeletingId(id)
    const res = await fetch(`/api/ai-agents/${id}`, { method: "DELETE" })
    setDeletingId(null)
    if (res.ok) {
      setAgents((prev) => prev.filter((a) => a.id !== id))
      toast.success("Agente excluído")
    } else {
      toast.error("Falha ao excluir agente")
    }
  }

  function openCreate() { setEditing(null); setFormOpen(true) }
  function openEdit(agent: AiAgent) { setEditing(agent); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditing(null) }

  function handleSaved(saved: AiAgent) {
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
    closeForm()
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agentes IA</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Assistentes autônomos que atendem clientes no WhatsApp e executam ações no CRM.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo agente
          </button>
        </div>

        {/* Empty state */}
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-foreground">Nenhum agente criado</h3>
            <p className="mb-5 max-w-sm text-sm text-muted-foreground">
              Crie um agente e atribua-o a uma conversa para que ele responda automaticamente no WhatsApp.
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Criar primeiro agente
            </button>
          </div>
        )}

        {/* Agent cards */}
        {agents.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 gap-4"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{agent.name}</p>
                      {agent.role && (
                        <p className="truncate text-xs text-muted-foreground">{agent.role}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(agent)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title={agent.is_active ? "Desativar" : "Ativar"}
                  >
                    {agent.is_active
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>

                {/* Prompt preview */}
                <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                  {agent.system_prompt || "Sem instruções definidas."}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {agent.provider === "anthropic" ? "Claude" : "GPT"}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {agent.model.split("-").slice(0, 3).join("-")}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    agent.is_active
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted text-muted-foreground"
                  }`}>
                    {agent.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                {/* Tools */}
                {agent.tools_enabled.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {agent.tools_enabled.length} ferramenta{agent.tools_enabled.length > 1 ? "s" : ""} habilitada{agent.tools_enabled.length > 1 ? "s" : ""}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-border">
                  <button
                    onClick={() => openEdit(agent)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => deleteAgent(agent.id)}
                    disabled={deletingId === agent.id}
                    className="flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Como usar</p>
          <p>
            Crie um agente, ative-o e depois atribua-o a uma conversa específica na Caixa de Entrada.
            O agente responde automaticamente quando uma mensagem chega e o fluxo não está ativo.
            Use a ferramenta <strong>Transferir para humano</strong> nas instruções para que o agente saiba quando chamar a equipe.
          </p>
        </div>
      </div>

      {/* Form sheet */}
      {formOpen && (
        <AgentForm
          agent={editing}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

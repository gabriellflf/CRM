"use client"

import { useState, useEffect } from "react"
import { X, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AgentPlayground } from "./agent-playground"
import type { AiAgent } from "@/types"

const TOOLS = [
  { id: "transferToHuman", label: "Transferir para humano", description: "Encerrar atendimento da IA e notificar operador" },
  { id: "addTag", label: "Adicionar tag", description: "Classificar o contato com uma tag no CRM" },
  { id: "updatePipelineStage", label: "Mover no pipeline", description: "Avançar o caso para outra etapa do funil" },
  { id: "closeConversation", label: "Fechar conversa", description: "Encerrar a conversa quando resolvida" },
]

const MODELS = {
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku (rápido e barato)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet (balanceado)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (rápido e barato)" },
    { value: "gpt-4o", label: "GPT-4o (mais capaz)" },
  ],
}

interface AgentFormProps {
  agent?: AiAgent | null
  onClose: () => void
  onSaved: (agent: AiAgent) => void
}

export function AgentForm({ agent, onClose, onSaved }: AgentFormProps) {
  const isEdit = !!agent

  const [name, setName] = useState(agent?.name ?? "")
  const [role, setRole] = useState(agent?.role ?? "")
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? "")
  const [provider, setProvider] = useState<"anthropic" | "openai">(agent?.provider ?? "anthropic")
  const [model, setModel] = useState(agent?.model ?? "claude-haiku-4-5-20251001")
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7)
  const [toolsEnabled, setToolsEnabled] = useState<string[]>(agent?.tools_enabled ?? ["transferToHuman"])
  const [saving, setSaving] = useState(false)
  const [showPlayground, setShowPlayground] = useState(false)

  // Reset model when provider changes
  useEffect(() => {
    const models = MODELS[provider]
    if (!models.find((m) => m.value === model)) {
      setModel(models[0].value)
    }
  }, [provider, model])

  function toggleTool(id: string) {
    setToolsEnabled((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return }
    if (!systemPrompt.trim()) { toast.error("Instruções são obrigatórias"); return }

    setSaving(true)
    try {
      const url = isEdit ? `/api/ai-agents/${agent.id}` : "/api/ai-agents"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, system_prompt: systemPrompt, provider, model, temperature, tools_enabled: toolsEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar")

      toast.success(isEdit ? "Agente atualizado" : "Agente criado")
      onSaved(data.agent)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel(s) */}
      <div className={cn("relative ml-auto flex h-full", showPlayground ? "w-[900px]" : "w-[520px]")}>
        {/* Playground panel */}
        {showPlayground && isEdit && (
          <div className="flex w-[380px] flex-col border-r border-border bg-background">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
              <p className="text-sm font-semibold text-foreground">Playground</p>
              <button onClick={() => setShowPlayground(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AgentPlayground agentId={agent.id} />
            </div>
          </div>
        )}

        {/* Form panel */}
        <div className="flex flex-1 flex-col border-l border-border bg-card">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
            <p className="text-base font-semibold text-foreground">
              {isEdit ? "Editar agente" : "Novo agente"}
            </p>
            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  onClick={() => setShowPlayground((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    showPlayground
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Testar
                  <ChevronRight className={cn("h-3 w-3 transition-transform", showPlayground && "rotate-180")} />
                </button>
              )}
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nome <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Triagem Bancária"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Função / Perfil</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: Assistente de triagem inicial"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Instruções do agente <span className="text-red-400">*</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={7}
                placeholder={`Ex: Você é a assistente virtual do escritório Mário Jorge Advocacia, especializado em Direito Bancário. Quando um cliente entrar em contato, identifique o tipo de problema (financiamento, cartão, execução judicial) e colete as informações necessárias para a equipe. Seja cordial e profissional.`}
                className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Model config */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Provedor</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "anthropic" | "openai")}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Modelo</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {MODELS[provider].map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Criatividade (temperatura)
                </label>
                <span className="text-xs tabular-nums text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Preciso</span>
                <span>Criativo</span>
              </div>
            </div>

            {/* Tools */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Habilidades / Ferramentas</label>
              <div className="space-y-2">
                {TOOLS.map((tool) => {
                  const enabled = toolsEnabled.includes(tool.id)
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        enabled
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-muted/40 hover:bg-muted",
                      )}
                    >
                      {/* Toggle */}
                      <div className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        enabled ? "bg-primary" : "bg-border",
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          enabled ? "translate-x-4" : "translate-x-0.5",
                        )} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{tool.label}</p>
                        <p className="text-[11px] text-muted-foreground">{tool.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar agente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

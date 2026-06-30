'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { SettingsPanelHead } from './settings-panel-head'

interface KeyStatus {
  openai_key_set: boolean
  anthropic_key_set: boolean
  openai_key_preview: string | null
  anthropic_key_preview: string | null
}

export function AiKeysPanel() {
  const { accountRole } = useAuth()
  const isAdmin = accountRole === 'admin' || accountRole === 'owner'

  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [showOpenai, setShowOpenai] = useState(false)
  const [showAnthropic, setShowAnthropic] = useState(false)

  useEffect(() => {
    fetch('/api/settings/ai-keys')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!openaiKey.trim() && !anthropicKey.trim()) {
      toast.error('Insira pelo menos uma chave')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (openaiKey.trim()) body.openai_api_key = openaiKey.trim()
      if (anthropicKey.trim()) body.anthropic_api_key = anthropicKey.trim()

      const res = await fetch('/api/settings/ai-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro')

      toast.success('Chaves salvas com sucesso')
      setOpenaiKey('')
      setAnthropicKey('')

      // Refresh status
      const updated = await fetch('/api/settings/ai-keys').then((r) => r.json())
      setStatus(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="Chaves de API — Agentes IA"
        description="Conecte sua conta OpenAI ou Anthropic para ativar os Agentes IA. As chaves são armazenadas criptografadas e nunca exibidas em texto claro."
      />

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem editar as chaves de API.
        </p>
      )}

      <div className="space-y-5 max-w-xl">
        {/* OpenAI */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              OpenAI API Key
            </label>
            {status?.openai_key_set && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configurada ({status.openai_key_preview})
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type={showOpenai ? 'text' : 'password'}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              disabled={!isAdmin}
              placeholder={
                status?.openai_key_set
                  ? 'Cole uma nova chave para substituir'
                  : 'sk-proj-...'
              }
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowOpenai((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada quando o agente está configurado com provedor <strong>OpenAI (GPT)</strong>.
          </p>
        </div>

        {/* Anthropic */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">
              Anthropic API Key
            </label>
            {status?.anthropic_key_set && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Configurada ({status.anthropic_key_preview})
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type={showAnthropic ? 'text' : 'password'}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              disabled={!isAdmin}
              placeholder={
                status?.anthropic_key_set
                  ? 'Cole uma nova chave para substituir'
                  : 'sk-ant-...'
              }
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowAnthropic((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada quando o agente está configurado com provedor <strong>Anthropic (Claude)</strong>.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving || (!openaiKey.trim() && !anthropicKey.trim())}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar chaves'}
          </button>
        )}
      </div>
    </div>
  )
}

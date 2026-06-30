"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlaygroundMessage {
  role: "user" | "assistant"
  content: string
  toolCalls?: Array<{ tool: string; input: Record<string, unknown> }>
}

interface AgentPlaygroundProps {
  agentId: string
}

export function AgentPlayground({ agentId }: AgentPlaygroundProps) {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const next: PlaygroundMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`/api/ai-agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro no servidor")

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.text ?? "",
          toolCalls: data.toolCalls ?? [],
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Erro: ${err instanceof Error ? err.message : "desconhecido"}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Envie uma mensagem para testar o agente.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="max-w-[80%] space-y-1.5">
              {m.content && (
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm",
                  )}
                >
                  {m.content}
                </div>
              )}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="space-y-1">
                  {m.toolCalls.map((tc, j) => (
                    <div
                      key={j}
                      className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300"
                    >
                      <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-semibold">{tc.tool}</span>
                        {" — "}
                        {Object.entries(tc.input)
                          .map(([k, v]) => `${k}: "${v}"`)
                          .join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Digite uma mensagem de teste..."
            className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Modo simulação — ferramentas não são executadas de verdade
        </p>
      </div>
    </div>
  )
}

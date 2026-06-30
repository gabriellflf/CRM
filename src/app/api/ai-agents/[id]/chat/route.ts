import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { TOOL_DEFINITIONS } from '@/lib/ai/tools'

// POST /api/ai-agents/[id]/chat
// Playground endpoint — simulates a conversation with the agent.
// Does NOT send WhatsApp messages or persist a real session.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!messages?.length) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  const { data: agent } = await db
    .from('ai_agents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const enabledTools = Array.isArray(agent.tools_enabled) ? agent.tools_enabled : []
  const tools = TOOL_DEFINITIONS.filter((t) => enabledTools.includes(t.name))

  const systemPrompt = [
    agent.system_prompt,
    '',
    '--- MODO PLAYGROUND ---',
    'Este é um teste simulado. Você está conversando com um operador do escritório.',
    'Aja como se fosse um atendimento real, mas não execute ferramentas — apenas descreva o que faria.',
    '--- FIM ---',
  ].join('\n')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const response = await client.messages.create({
      model: agent.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: agent.temperature ?? 0.7,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    // Describe tool calls without executing them
    const toolCalls = response.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => {
        if (b.type !== 'tool_use') return null
        return { tool: b.name, input: b.input }
      })
      .filter(Boolean)

    return NextResponse.json({ text, toolCalls })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LLM error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

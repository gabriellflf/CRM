import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { supabaseAdmin } from './admin-client'
import { engineSendText } from '@/lib/flows/meta-send'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools'
import { decrypt } from '@/lib/whatsapp/encryption'

const MAX_TOOL_ITERATIONS = 5

export interface DispatchInput {
  conversationId: string
  contactId: string
  accountId: string
  messageText: string
  configUserId: string
}

// ---------------------------------------------------------------------------
// Entry point — called by the webhook after flow dispatch
// ---------------------------------------------------------------------------

export async function dispatchToAiAgent(input: DispatchInput): Promise<boolean> {
  const db = supabaseAdmin()

  const { data: conv } = await db
    .from('conversations')
    .select('ai_agent_id')
    .eq('id', input.conversationId)
    .maybeSingle()

  if (!conv?.ai_agent_id) return false

  const { data: agent } = await db
    .from('ai_agents')
    .select('*')
    .eq('id', conv.ai_agent_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!agent) return false

  try {
    await runAgent(agent, input)
  } catch (err) {
    console.error('[ai-agent] runAgent failed:', err)
  }

  return true
}

// ---------------------------------------------------------------------------
// Fetch the API key for a provider — DB first, env var fallback
// ---------------------------------------------------------------------------

async function fetchApiKey(accountId: string, provider: string): Promise<string> {
  const db = supabaseAdmin()
  const { data } = await db
    .from('ai_config')
    .select('openai_api_key, anthropic_api_key')
    .eq('account_id', accountId)
    .maybeSingle()

  if (provider === 'openai') {
    if (data?.openai_api_key) return decrypt(data.openai_api_key)
    return process.env.OPENAI_API_KEY ?? ''
  }
  if (data?.anthropic_api_key) return decrypt(data.anthropic_api_key)
  return process.env.ANTHROPIC_API_KEY ?? ''
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

async function runAgent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Record<string, any>,
  input: DispatchInput,
) {
  const db = supabaseAdmin()

  // ── 1. Build contact context ─────────────────────────────────────────────
  const { data: contact } = await db
    .from('contacts')
    .select('name, phone, company, cpf, description, tags:contact_tags(tag:tags(name))')
    .eq('id', input.contactId)
    .eq('account_id', input.accountId)
    .maybeSingle()

  const { data: openDeal } = await db
    .from('deals')
    .select('title, value, stage:pipeline_stages(name), pipeline:pipelines(name)')
    .eq('contact_id', input.contactId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tagNames = (contact?.tags ?? []).map((t: any) => t?.tag?.name).filter(Boolean).join(', ')

  const contextBlock = [
    `Nome: ${contact?.name ?? 'não informado'}`,
    `Telefone: ${contact?.phone ?? ''}`,
    contact?.company ? `Empresa: ${contact.company}` : null,
    contact?.cpf ? `CPF: ${contact.cpf}` : null,
    contact?.description ? `Observações: ${contact.description}` : null,
    tagNames ? `Tags: ${tagNames}` : null,
    openDeal
      ? `Caso em aberto: "${openDeal.title}" — Pipeline: ${(openDeal.pipeline as { name?: string })?.name ?? ''}, Etapa: ${(openDeal.stage as { name?: string })?.name ?? ''}`
      : 'Sem casos abertos',
  ]
    .filter(Boolean)
    .join('\n')

  // ── 2. Build / restore message history ───────────────────────────────────
  const { data: session } = await db
    .from('ai_agent_sessions')
    .select('id, messages')
    .eq('conversation_id', input.conversationId)
    .maybeSingle()

  const history: Array<{ role: 'user' | 'assistant'; content: string }> =
    (session?.messages ?? []).slice(-30)

  history.push({ role: 'user', content: input.messageText })

  // ── 3. System prompt with context injection ───────────────────────────────
  const systemPrompt = [
    agent.system_prompt,
    '',
    '--- DADOS DO CLIENTE ---',
    contextBlock,
    '--- FIM DOS DADOS ---',
    '',
    'Responda sempre em português. Seja profissional e cordial.',
    'Use as ferramentas disponíveis quando necessário. Nunca invente informações.',
  ].join('\n')

  // ── 4. Filter tools to what is enabled for this agent ────────────────────
  const enabledTools = Array.isArray(agent.tools_enabled) ? agent.tools_enabled : []
  const tools = TOOL_DEFINITIONS.filter((t) => enabledTools.includes(t.name))

  const toolCtx: ToolContext = {
    accountId: input.accountId,
    contactId: input.contactId,
    conversationId: input.conversationId,
    configUserId: input.configUserId,
  }

  // ── 5. Fetch API key and run provider-specific loop ───────────────────────
  const provider = (agent.provider as string) ?? 'anthropic'
  const apiKey = await fetchApiKey(input.accountId, provider)

  if (!apiKey) {
    console.error(`[ai-agent] No API key configured for provider "${provider}"`)
    return
  }

  let finalText: string | null = null

  if (provider === 'openai') {
    finalText = await runOpenAiLoop({ agent, apiKey, systemPrompt, history, tools, toolCtx })
  } else {
    finalText = await runAnthropicLoop({ agent, apiKey, systemPrompt, history, tools, toolCtx })
  }

  // ── 6. Send reply back via WhatsApp ───────────────────────────────────────
  if (finalText) {
    await engineSendText({
      accountId: input.accountId,
      userId: input.configUserId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      text: finalText,
    })
  }

  // ── 7. Persist updated history ────────────────────────────────────────────
  const updatedMessages = [
    ...history,
    ...(finalText ? [{ role: 'assistant' as const, content: finalText }] : []),
  ].slice(-60)

  if (session?.id) {
    await db
      .from('ai_agent_sessions')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', session.id)
  } else {
    await db.from('ai_agent_sessions').insert({
      account_id: input.accountId,
      conversation_id: input.conversationId,
      agent_id: agent.id,
      messages: updatedMessages,
    })
  }
}

// ---------------------------------------------------------------------------
// Anthropic loop
// ---------------------------------------------------------------------------

interface LoopArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Record<string, any>
  apiKey: string
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: Anthropic.Tool[]
  toolCtx: ToolContext
}

async function runAnthropicLoop({
  agent, apiKey, systemPrompt, history, tools, toolCtx,
}: LoopArgs): Promise<string | null> {
  const client = new Anthropic({ apiKey })
  let currentMessages = [...history]
  let finalText: string | null = null

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: agent.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: agent.temperature ?? 0.7,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools.length > 0 ? tools : undefined,
    })

    if (response.stop_reason === 'end_turn') {
      const tb = response.content.find((b) => b.type === 'text')
      finalText = tb && tb.type === 'text' ? tb.text : null
      break
    }

    if (response.stop_reason === 'tool_use') {
      currentMessages.push({
        role: 'assistant',
        content: JSON.stringify(response.content),
      })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const resultText = await executeTool(block.name, block.input as Record<string, unknown>, toolCtx)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: resultText })
      }
      currentMessages.push({ role: 'user', content: JSON.stringify(results) })
      continue
    }

    const tb = response.content.find((b) => b.type === 'text')
    finalText = tb && tb.type === 'text' ? tb.text : null
    break
  }

  return finalText
}

// ---------------------------------------------------------------------------
// OpenAI loop
// ---------------------------------------------------------------------------

function toOpenAiTools(tools: Anthropic.Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema as Record<string, unknown>,
    },
  }))
}

interface OpenAiLoopArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: Record<string, any>
  apiKey: string
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: Anthropic.Tool[]
  toolCtx: ToolContext
}

async function runOpenAiLoop({
  agent, apiKey, systemPrompt, history, tools, toolCtx,
}: OpenAiLoopArgs): Promise<string | null> {
  const client = new OpenAI({ apiKey })
  const openAiTools = toOpenAiTools(tools)

  type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam
  let messages: Msg[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content } as Msg)),
  ]

  let finalText: string | null = null

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model: agent.model ?? 'gpt-4o-mini',
      temperature: agent.temperature ?? 0.7,
      messages,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
      tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
    })

    const choice = response.choices[0]

    if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
      finalText = choice.message.content ?? null
      break
    }

    if (choice.finish_reason === 'tool_calls') {
      const toolCalls = choice.message.tool_calls ?? []
      messages.push({ role: 'assistant', content: null, tool_calls: toolCalls })

      for (const tc of toolCalls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (tc as any).function as { name: string; arguments: string } | undefined
        if (!fn) continue
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(fn.arguments) } catch { /* malformed args */ }
        const resultText = await executeTool(fn.name, args, toolCtx)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultText,
        })
      }
      continue
    }

    finalText = choice.message.content ?? null
    break
  }

  return finalText
}

import type Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './admin-client'

// ---------------------------------------------------------------------------
// Tool context passed to every executeTool call
// ---------------------------------------------------------------------------

export interface ToolContext {
  accountId: string
  contactId: string
  conversationId: string
  configUserId: string
}

// ---------------------------------------------------------------------------
// Anthropic tool definitions (JSON Schema)
// The names here must match the keys in TOOL_HANDLERS below.
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'transferToHuman',
    description:
      'Encerra o atendimento do agente de IA e transfere a conversa para um operador humano. Use quando o cliente precisar de atendimento especializado, quando houver urgência, ou quando o agente não conseguir resolver o problema.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Motivo da transferência (aparece como nota interna para o operador)',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'addTag',
    description:
      'Adiciona uma tag ao contato no CRM. Útil para classificar o tipo de problema, urgência ou estágio do cliente.',
    input_schema: {
      type: 'object',
      properties: {
        tag_name: {
          type: 'string',
          description: 'Nome da tag a adicionar (ex: "Direito Bancário", "Urgente", "Agronegócio")',
        },
      },
      required: ['tag_name'],
    },
  },
  {
    name: 'updatePipelineStage',
    description:
      'Move o deal/caso do contato para uma etapa do pipeline. Use após coletar informações suficientes para classificar o caso.',
    input_schema: {
      type: 'object',
      properties: {
        stage_id: {
          type: 'string',
          description: 'UUID da etapa de destino no pipeline',
        },
      },
      required: ['stage_id'],
    },
  },
  {
    name: 'closeConversation',
    description:
      'Fecha a conversa no CRM. Use somente quando o assunto foi completamente resolvido e o cliente confirmou.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Motivo do encerramento',
        },
      },
      required: [],
    },
  },
]

// Map tool name → enabled flag name (same for now, but isolated for future renaming)
export const TOOL_NAMES = TOOL_DEFINITIONS.map((t) => t.name)

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type ToolResult = { ok: boolean; message: string }

async function transferToHuman(
  args: { reason: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  const db = supabaseAdmin()

  // Remove AI agent from conversation
  const { error: convErr } = await db
    .from('conversations')
    .update({ ai_agent_id: null })
    .eq('id', ctx.conversationId)

  if (convErr) return { ok: false, message: convErr.message }

  // Insert internal note so the human agent knows what happened
  const noteText = `🤖 Transferido para atendimento humano. Motivo: ${args.reason}`
  await db.from('messages').insert({
    conversation_id: ctx.conversationId,
    sender_type: 'agent',
    sender_id: ctx.configUserId,
    content_type: 'text',
    content_text: noteText,
    status: 'sent',
    is_note: true,
  })

  return { ok: true, message: 'Conversa transferida para operador humano.' }
}

async function addTag(
  args: { tag_name: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  const db = supabaseAdmin()
  const tagName = args.tag_name.trim()

  // Upsert tag (scoped to account)
  const { data: tag, error: tagErr } = await db
    .from('tags')
    .upsert({ name: tagName, account_id: ctx.accountId }, { onConflict: 'name,account_id' })
    .select('id')
    .single()

  if (tagErr || !tag) return { ok: false, message: tagErr?.message ?? 'tag upsert failed' }

  // Associate with contact (ignore duplicate)
  const { error: linkErr } = await db
    .from('contact_tags')
    .upsert({ contact_id: ctx.contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' })

  if (linkErr) return { ok: false, message: linkErr.message }
  return { ok: true, message: `Tag "${tagName}" adicionada ao contato.` }
}

async function updatePipelineStage(
  args: { stage_id: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  const db = supabaseAdmin()

  // Find the most recent open deal for this contact
  const { data: deal, error: dealErr } = await db
    .from('deals')
    .select('id')
    .eq('contact_id', ctx.contactId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dealErr) return { ok: false, message: dealErr.message }
  if (!deal) return { ok: false, message: 'Nenhum caso aberto encontrado para este contato.' }

  const { error: updateErr } = await db
    .from('deals')
    .update({ stage_id: args.stage_id })
    .eq('id', deal.id)

  if (updateErr) return { ok: false, message: updateErr.message }
  return { ok: true, message: 'Caso movido para a nova etapa do pipeline.' }
}

async function closeConversation(
  _args: { reason?: string },
  ctx: ToolContext,
): Promise<ToolResult> {
  const db = supabaseAdmin()

  const { error } = await db
    .from('conversations')
    .update({ status: 'closed', ai_agent_id: null })
    .eq('id', ctx.conversationId)

  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Conversa encerrada.' }
}

// ---------------------------------------------------------------------------
// Dispatcher — called by the agent runner for each tool_use block
// ---------------------------------------------------------------------------

export async function executeTool(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInput: Record<string, any>,
  ctx: ToolContext,
): Promise<string> {
  let result: ToolResult

  switch (toolName) {
    case 'transferToHuman':
      result = await transferToHuman(toolInput as { reason: string }, ctx)
      break
    case 'addTag':
      result = await addTag(toolInput as { tag_name: string }, ctx)
      break
    case 'updatePipelineStage':
      result = await updatePipelineStage(toolInput as { stage_id: string }, ctx)
      break
    case 'closeConversation':
      result = await closeConversation(toolInput as { reason?: string }, ctx)
      break
    default:
      result = { ok: false, message: `Ferramenta desconhecida: ${toolName}` }
  }

  return result.message
}

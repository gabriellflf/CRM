import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/conversations/[id]/assign-ai
// Body: { ai_agent_id: string | null }
// Pass null to remove the agent from the conversation.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const agentId: string | null = body.ai_agent_id ?? null

  // Verify agent belongs to same account if assigning
  if (agentId) {
    const { data: profile } = await db
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: agent } = await db
      .from('ai_agents')
      .select('id, account_id, is_active')
      .eq('id', agentId)
      .maybeSingle()

    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    if (agent.account_id !== profile?.account_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!agent.is_active) {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 400 })
    }
  }

  const { data, error } = await db
    .from('conversations')
    .update({ ai_agent_id: agentId })
    .eq('id', id)
    .select('id, ai_agent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversation: data })
}

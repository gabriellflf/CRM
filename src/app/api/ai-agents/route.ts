import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/ai-agents — list all agents for the caller's account
export async function GET() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('ai_agents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agents: data })
}

// POST /api/ai-agents — create a new agent
export async function POST(request: Request) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await db
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.account_id) return NextResponse.json({ error: 'No account' }, { status: 403 })
  if (profile.account_role !== 'admin' && profile.account_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, role, system_prompt, provider, model, temperature, tools_enabled } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!system_prompt?.trim()) return NextResponse.json({ error: 'system_prompt is required' }, { status: 400 })

  const { data, error } = await db
    .from('ai_agents')
    .insert({
      account_id: profile.account_id,
      name: name.trim(),
      role: role?.trim() || null,
      system_prompt: system_prompt.trim(),
      provider: provider ?? 'anthropic',
      model: model?.trim() || 'claude-haiku-4-5-20251001',
      temperature: temperature ?? 0.7,
      tools_enabled: tools_enabled ?? [],
      is_active: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agent: data }, { status: 201 })
}

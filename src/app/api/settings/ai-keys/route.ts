import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.account_id) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const admin = supabaseAdmin()
    const { data } = await admin
      .from('ai_config')
      .select('openai_api_key, anthropic_api_key')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    return NextResponse.json({
      openai_key_set: !!data?.openai_api_key,
      anthropic_key_set: !!data?.anthropic_api_key,
      openai_key_preview: data?.openai_api_key
        ? `••••${decrypt(data.openai_api_key).slice(-4)}`
        : null,
      anthropic_key_preview: data?.anthropic_api_key
        ? `••••${decrypt(data.anthropic_api_key).slice(-4)}`
        : null,
    })
  } catch (err) {
    console.error('[ai-keys] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.account_id) return NextResponse.json({ error: 'No account' }, { status: 403 })
    if (profile.account_role !== 'admin' && profile.account_role !== 'owner') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const admin = supabaseAdmin()

    // Fetch existing row so we preserve whichever key isn't being updated
    const { data: existing } = await admin
      .from('ai_config')
      .select('id, openai_api_key, anthropic_api_key')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.openai_api_key === 'string') {
      updates.openai_api_key = body.openai_api_key.trim()
        ? encrypt(body.openai_api_key.trim())
        : null
    }
    if (typeof body.anthropic_api_key === 'string') {
      updates.anthropic_api_key = body.anthropic_api_key.trim()
        ? encrypt(body.anthropic_api_key.trim())
        : null
    }

    if (existing?.id) {
      await admin.from('ai_config').update(updates).eq('id', existing.id)
    } else {
      await admin.from('ai_config').insert({ account_id: profile.account_id, ...updates })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ai-keys] PUT error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

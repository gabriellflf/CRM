import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/ai/admin-client'
import { hasMinRole } from '@/lib/auth/roles'

// DELETE /api/team/members/[id]
// Removes a member from the account (sets account_id + account_role to null on their profile).
// Only owner and admin can call this. Admins cannot remove other admins or owners.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.id === targetUserId) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
  }

  // Fetch caller's profile
  const { data: callerProfile } = await db
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', user.id)
    .maybeSingle()

  const callerRole = callerProfile?.account_role ?? 'agent'
  const accountId = callerProfile?.account_id

  if (!hasMinRole(callerRole, 'admin')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const admin = supabaseAdmin()

  // Fetch target's profile to enforce role hierarchy
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('account_id, account_role')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!targetProfile || targetProfile.account_id !== accountId) {
    return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  }

  const targetRole = targetProfile.account_role ?? 'agent'

  // Admins cannot remove other admins or owners — only owners can
  if (callerRole === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
    return NextResponse.json({ error: 'Admins não podem remover outros admins ou proprietários' }, { status: 403 })
  }

  // Remove member: clear account association
  const { error } = await admin
    .from('profiles')
    .update({ account_id: null, account_role: null })
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

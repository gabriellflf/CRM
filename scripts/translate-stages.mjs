import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const renames = [
  ['New Lead',       'Novo Lead'],
  ['Qualified',      'Qualificado'],
  ['Proposal Sent',  'Proposta Enviada'],
  ['Negotiation',    'Negociação'],
  ['Won',            'Ganho'],
]

for (const [from, to] of renames) {
  const { error } = await supabase.from('pipeline_stages').update({ name: to }).eq('name', from)
  if (error) console.error(`❌ ${from}:`, error.message)
  else console.log(`✅ ${from} → ${to}`)
}

-- Memória de longo prazo por contato.
-- O agente gera/atualiza este registro após cada conversa,
-- acumulando perfil, necessidades e padrões de comunicação do cliente.

CREATE TABLE contact_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

ALTER TABLE contact_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account members" ON contact_memories FOR ALL
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

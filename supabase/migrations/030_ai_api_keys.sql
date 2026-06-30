-- AI provider configuration (API keys) per account.
-- Stored encrypted server-side; browser only sees "set or not set" status.

CREATE TABLE ai_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  openai_api_key  text,
  anthropic_api_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_config_account_members"
  ON ai_config FOR ALL
  USING  (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

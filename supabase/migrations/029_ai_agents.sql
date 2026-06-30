-- AI Agents: autonomous LLM-powered agents that handle WhatsApp conversations.
-- Each agent belongs to an account (multi-tenant), has a system prompt, and
-- a list of CRM tools it is allowed to call (stored as a jsonb string array).

CREATE TABLE ai_agents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  role          text,
  system_prompt text        NOT NULL DEFAULT '',
  provider      text        NOT NULL DEFAULT 'anthropic'
                            CHECK (provider IN ('anthropic', 'openai')),
  model         text        NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  temperature   numeric(3,2) NOT NULL DEFAULT 0.70
                            CHECK (temperature >= 0 AND temperature <= 2),
  is_active     boolean     NOT NULL DEFAULT false,
  -- jsonb string array of enabled tool names, e.g. ["transferToHuman","addTag"]
  tools_enabled jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agents_account_members"
  ON ai_agents FOR ALL
  USING  (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

-- Per-conversation LLM message history.
-- The LLM is stateless; we persist the {role, content} array so each
-- inbound message can be sent alongside the full prior exchange.
-- UNIQUE(conversation_id) — one session per conversation, ever.

CREATE TABLE ai_agent_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id        uuid        NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  -- [{role: 'user'|'assistant', content: string}]
  messages        jsonb       NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_sessions_account_members"
  ON ai_agent_sessions FOR ALL
  USING  (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

-- Link a conversation to an AI agent.
-- NULL = no agent assigned (human or flow handles it).
-- ON DELETE SET NULL: deleting the agent gracefully unassigns all conversations.

ALTER TABLE conversations
  ADD COLUMN ai_agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;

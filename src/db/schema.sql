-- AetherQA — PostgreSQL schema
-- Run once on a fresh database. LangGraph checkpointer tables are auto-created by the SDK.

CREATE TABLE IF NOT EXISTS qa_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_mode     TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  qa_user_id   TEXT,
  scope_json   JSONB
);

CREATE TABLE IF NOT EXISTS test_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES qa_runs(id),
  spec_id         TEXT NOT NULL,
  spec_title      TEXT NOT NULL,
  spec_bucket     TEXT NOT NULL,   -- 'feature' | 'regression'
  status          TEXT NOT NULL,   -- 'pass' | 'fail' | 'skip'
  duration_ms     INTEGER,
  error_message   TEXT,
  failure_trace   TEXT,
  screenshot_path TEXT,
  healed          BOOLEAN DEFAULT FALSE,
  escalated       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_test_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES qa_runs(id),
  endpoint        TEXT NOT NULL,
  test_name       TEXT NOT NULL,
  status          TEXT NOT NULL,
  status_code     INTEGER,
  duration_ms     INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results (run_id);
CREATE INDEX IF NOT EXISTS idx_api_test_results_run_id ON api_test_results (run_id);
CREATE INDEX IF NOT EXISTS idx_qa_runs_status ON qa_runs (status);

-- ─── Auth tables (Week 6) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                     -- NULL for OAuth-only accounts
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY,           -- jti claim from the JWT
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,              -- SHA-256 of the raw refresh JWT
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- LangGraph checkpointer tables are auto-created by PostgresSaver.setup()
-- They store paused graph state for human-in-the-loop resumption.

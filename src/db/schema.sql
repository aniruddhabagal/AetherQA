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

-- LangGraph checkpointer tables are auto-created by PostgresSaver.setup()
-- They store paused graph state for human-in-the-loop resumption.

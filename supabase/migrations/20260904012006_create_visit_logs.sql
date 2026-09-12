/*
# Create visit_logs table for website visitor tracking

1. New Tables
- `visit_logs`
  - `id` (uuid, primary key)
  - `session_id` (text, not null) — anonymous per-session identifier
  - `page_path` (text, not null) — the route path visited
  - `visited_at` (timestamptz, default now()) — timestamp of visit
2. Indexes
- `idx_visit_logs_visited_at` on `visited_at` for time-range queries
- `idx_visit_logs_session_id` on `session_id` for unique visitor counts
3. Security
- Enable RLS on `visit_logs`.
- Allow anon + authenticated to INSERT (visitor tracking is public).
- Allow only authenticated to SELECT (admin dashboard reads stats).
- No UPDATE or DELETE policies (visits are immutable).
*/

CREATE TABLE IF NOT EXISTS visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  page_path text NOT NULL DEFAULT '/',
  visited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_logs_visited_at ON visit_logs (visited_at);
CREATE INDEX IF NOT EXISTS idx_visit_logs_session_id ON visit_logs (session_id);

ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_visits" ON visit_logs;
CREATE POLICY "anon_insert_visits"
ON visit_logs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_visits" ON visit_logs;
CREATE POLICY "auth_select_visits"
ON visit_logs FOR SELECT
TO authenticated USING (true);

/*
# Create system_versions, system_updates, system_backups tables + storage buckets

1. New Tables (created in dependency order: system_versions, system_backups, system_updates)
- `system_versions` — tracks the currently active system version
- `system_backups` — tracks backup files in the system-backups bucket
- `system_updates` — tracks uploaded update packages and their install lifecycle
  - backup_id FK -> system_backups(id) ON DELETE SET NULL
- `system_backups.update_id` FK -> system_updates(id) ON DELETE SET NULL (added after both tables exist)

2. Security
- All three tables have RLS enabled.
- SELECT: anon + authenticated can read.
- INSERT/UPDATE/DELETE: authenticated only.

3. Storage Buckets
- `system-backups` (private), `system-updates` (private).

4. Seed
- Default system_versions row: version "1.0.0", status "active".
*/

-- ============ system_versions ============
CREATE TABLE IF NOT EXISTS system_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  installed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_auth_read_system_versions" ON system_versions;
CREATE POLICY "anon_auth_read_system_versions" ON system_versions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_system_versions" ON system_versions;
CREATE POLICY "auth_insert_system_versions" ON system_versions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_system_versions" ON system_versions;
CREATE POLICY "auth_update_system_versions" ON system_versions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_system_versions" ON system_versions;
CREATE POLICY "auth_delete_system_versions" ON system_versions FOR DELETE
  TO authenticated USING (true);

-- ============ system_backups (created before system_updates for FK) ============
CREATE TABLE IF NOT EXISTS system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_name text NOT NULL,
  version text NOT NULL,
  backup_path text,
  storage_path text,
  backup_type text NOT NULL DEFAULT 'manual',
  file_size bigint,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  update_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_auth_read_system_backups" ON system_backups;
CREATE POLICY "anon_auth_read_system_backups" ON system_backups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_system_backups" ON system_backups;
CREATE POLICY "auth_insert_system_backups" ON system_backups FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_system_backups" ON system_backups;
CREATE POLICY "auth_update_system_backups" ON system_backups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_system_backups" ON system_backups;
CREATE POLICY "auth_delete_system_backups" ON system_backups FOR DELETE
  TO authenticated USING (true);

-- ============ system_updates ============
CREATE TABLE IF NOT EXISTS system_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  previous_version text,
  update_type text NOT NULL DEFAULT 'feature',
  description text,
  package_name text,
  package_path text,
  manifest jsonb,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  backup_id uuid REFERENCES system_backups(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  installed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_auth_read_system_updates" ON system_updates;
CREATE POLICY "anon_auth_read_system_updates" ON system_updates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_system_updates" ON system_updates;
CREATE POLICY "auth_insert_system_updates" ON system_updates FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_system_updates" ON system_updates;
CREATE POLICY "auth_update_system_updates" ON system_updates FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_system_updates" ON system_updates;
CREATE POLICY "auth_delete_system_updates" ON system_updates FOR DELETE
  TO authenticated USING (true);

-- ============ Add update_id FK on system_backups (now that system_updates exists) ============
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'system_backups_update_id_fkey'
    AND table_name = 'system_backups'
  ) THEN
    ALTER TABLE system_backups
    ADD CONSTRAINT system_backups_update_id_fkey
    FOREIGN KEY (update_id) REFERENCES system_updates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============ Indexes ============
CREATE INDEX IF NOT EXISTS idx_system_updates_status ON system_updates(status);
CREATE INDEX IF NOT EXISTS idx_system_updates_version ON system_updates(version);
CREATE INDEX IF NOT EXISTS idx_system_backups_status ON system_backups(status);
CREATE INDEX IF NOT EXISTS idx_system_backups_update_id ON system_backups(update_id);

-- ============ Seed default version ============
INSERT INTO system_versions (version, description, status)
VALUES ('1.0.0', 'Versi awal sistem Vixel', 'active')
ON CONFLICT DO NOTHING;

-- ============ Storage Buckets ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-backups', 'system-backups', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('system-updates', 'system-updates', false)
ON CONFLICT (id) DO NOTHING;

-- ============ Storage Policies for system-backups ============
DROP POLICY IF EXISTS "auth_read_system_backups_storage" ON storage.objects;
CREATE POLICY "auth_read_system_backups_storage" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'system-backups');

DROP POLICY IF EXISTS "auth_insert_system_backups_storage" ON storage.objects;
CREATE POLICY "auth_insert_system_backups_storage" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'system-backups');

DROP POLICY IF EXISTS "auth_update_system_backups_storage" ON storage.objects;
CREATE POLICY "auth_update_system_backups_storage" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'system-backups') WITH CHECK (bucket_id = 'system-backups');

DROP POLICY IF EXISTS "auth_delete_system_backups_storage" ON storage.objects;
CREATE POLICY "auth_delete_system_backups_storage" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'system-backups');

-- ============ Storage Policies for system-updates ============
DROP POLICY IF EXISTS "auth_read_system_updates_storage" ON storage.objects;
CREATE POLICY "auth_read_system_updates_storage" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'system-updates');

DROP POLICY IF EXISTS "auth_insert_system_updates_storage" ON storage.objects;
CREATE POLICY "auth_insert_system_updates_storage" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'system-updates');

DROP POLICY IF EXISTS "auth_update_system_updates_storage" ON storage.objects;
CREATE POLICY "auth_update_system_updates_storage" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'system-updates') WITH CHECK (bucket_id = 'system-updates');

DROP POLICY IF EXISTS "auth_delete_system_updates_storage" ON storage.objects;
CREATE POLICY "auth_delete_system_updates_storage" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'system-updates');

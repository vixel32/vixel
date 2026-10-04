/*
# Add backup_scope column to system_backups

1. Changes
- Adds `backup_scope` text column to `system_backups` (nullable, default 'full_data').
  Values: 'database' | 'full_data' | 'pre_update'.
  - 'database' = database-only backup (legacy v1.0 behavior)
  - 'full_data' = database + storage backup (v2.0)
  - 'pre_update' = full data backup created automatically before an update

2. Backward Compatibility
- Existing rows get 'full_data' as default since the create-backup function
  will be upgraded to produce full_data backups going forward.
- No existing data is deleted or modified beyond adding the column.

3. Security
- No RLS policy changes needed — column is accessible through existing policies.
*/

ALTER TABLE system_backups
ADD COLUMN IF NOT EXISTS backup_scope text NOT NULL DEFAULT 'full_data';

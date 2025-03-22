-- Migration script for adding private space support to BridgeSpace

-- Add private_space_key column to shared_files table
ALTER TABLE shared_files
ADD COLUMN IF NOT EXISTS private_space_key TEXT;

-- Add private_space_key column to shared_texts table
ALTER TABLE shared_texts
ADD COLUMN IF NOT EXISTS private_space_key TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS shared_files_private_space_key_idx ON shared_files(private_space_key);
CREATE INDEX IF NOT EXISTS shared_texts_private_space_key_idx ON shared_texts(private_space_key);

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can only access their network files" ON shared_files;
DROP POLICY IF EXISTS "Users can only insert files from their network" ON shared_files;
DROP POLICY IF EXISTS "Users can only delete files from their network" ON shared_files;

DROP POLICY IF EXISTS "Users can only access their network texts" ON shared_texts;
DROP POLICY IF EXISTS "Users can only insert texts from their network" ON shared_texts;
DROP POLICY IF EXISTS "Users can only update texts from their network" ON shared_texts;
DROP POLICY IF EXISTS "Users can only delete texts from their network" ON shared_texts;

-- Create updated RLS policies for shared_files with a simplified approach
-- This allows access to files either if:
-- 1. The network_prefix matches the client's network
-- 2. The file has a private_space_key and it's publicly visible
CREATE POLICY "Users can access files from their network or private space"
ON shared_files FOR SELECT
USING (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

CREATE POLICY "Users can insert files to their network or private space"
ON shared_files FOR INSERT
WITH CHECK (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

CREATE POLICY "Users can delete files from their network or private space"
ON shared_files FOR DELETE
USING (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

-- Create updated RLS policies for shared_texts with a simplified approach
CREATE POLICY "Users can access texts from their network or private space"
ON shared_texts FOR SELECT
USING (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

CREATE POLICY "Users can insert texts to their network or private space"
ON shared_texts FOR INSERT
WITH CHECK (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

CREATE POLICY "Users can update texts from their network or private space"
ON shared_texts FOR UPDATE
USING (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

CREATE POLICY "Users can delete texts from their network or private space"
ON shared_texts FOR DELETE
USING (
  (network_prefix = (SPLIT_PART(inet_client_addr()::text, '.', 1) || '.')) OR
  (private_space_key IS NOT NULL)
);

-- Make sure RLS is enabled for both tables
ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_texts ENABLE ROW LEVEL SECURITY;

-- Note: With this simplified approach, we're relying on the application logic
-- to filter private spaces by their key, rather than using database-level
-- security for that aspect. This avoids the need for custom headers.

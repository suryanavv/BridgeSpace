-- BridgeSpace Supabase Setup SQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create tables
CREATE TABLE IF NOT EXISTS network_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_texts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  private_space_key TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  private_space_key TEXT,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shared_files', 'shared_files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow public access to files
CREATE POLICY storage_policy ON storage.objects FOR ALL TO authenticated, anon
USING (bucket_id = 'shared_files')
WITH CHECK (bucket_id = 'shared_files');

-- Create helper function to extract storage path from URL
CREATE OR REPLACE FUNCTION get_storage_path_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  path TEXT;
BEGIN
  -- Extract the path after 'shared_files/'
  path := substring(url from '.*shared_files/(.*)$');
  RETURN path;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Create function to delete a shared file entry and its storage object
CREATE OR REPLACE FUNCTION delete_shared_file_entry(file_url TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  storage_path TEXT;
  file_id UUID;
  result INTEGER := 0;
BEGIN
  -- Get the file ID
  SELECT id INTO file_id FROM shared_files WHERE url = file_url;
  
  IF file_id IS NULL THEN
    RAISE NOTICE 'File not found with URL: %', file_url;
    RETURN 0;
  END IF;
  
  -- Extract the storage path
  storage_path := get_storage_path_from_url(file_url);
  
  IF storage_path IS NULL THEN
    RAISE NOTICE 'Could not extract storage path from URL: %', file_url;
  ELSE
    -- Delete from storage
    BEGIN
      DELETE FROM storage.objects WHERE name = storage_path AND bucket_id = 'shared_files';
      result := result + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error deleting from storage: %', SQLERRM;
    END;
  END IF;
  
  -- Delete from database
  DELETE FROM shared_files WHERE id = file_id;
  result := result + 1;
  
  RETURN result;
END;
$$;

-- Create cleanup function that uses IST timezone
CREATE OR REPLACE FUNCTION cleanup_old_files()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  ist_cutoff_date TIMESTAMP;
  file_record RECORD;
  storage_path TEXT;
  deleted_count INTEGER := 0;
BEGIN
  -- Calculate the cutoff date in IST (7 days ago from IST midnight)
  ist_cutoff_date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '7 days';
  ist_cutoff_date := (ist_cutoff_date AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC');
  
  -- Log the cutoff date for debugging
  RAISE NOTICE 'Cleaning up files older than %', ist_cutoff_date;
  
  -- Find files older than the cutoff date
  FOR file_record IN 
    SELECT id, url, shared_at 
    FROM shared_files 
    WHERE shared_at < ist_cutoff_date
  LOOP
    -- Try to extract the storage path from the URL
    BEGIN
      -- Extract the path after 'shared_files/'
      storage_path := substring(file_record.url from '.*shared_files/(.*)$');
      
      IF storage_path IS NOT NULL THEN
        -- Call the delete_shared_file_entry function to remove the file
        PERFORM delete_shared_file_entry(file_record.url);
        deleted_count := deleted_count + 1;
      ELSE
        RAISE NOTICE 'Could not extract storage path from URL: %', file_record.url;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing file %: %', file_record.id, SQLERRM;
    END;
  END LOOP;
  
  -- Also clean up old shared texts
  DELETE FROM shared_texts WHERE shared_at < ist_cutoff_date;
  
  -- Log the results
  RAISE NOTICE 'Cleanup completed. Deleted % files.', deleted_count;
  
  -- Return success
  RETURN;
END;
$$;

-- Schedule the cleanup job to run at midnight IST (18:30 UTC)
SELECT cron.schedule(
  'cleanup-old-files-midnight-ist',
  '30 18 * * *',  -- 18:30 UTC = 00:00 IST
  'SELECT cleanup_old_files()'
);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE shared_files;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_texts;
ALTER PUBLICATION supabase_realtime ADD TABLE network_connections;

-- Create RLS policies
ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_connections ENABLE ROW LEVEL SECURITY;

-- Allow public access to all tables
CREATE POLICY shared_files_policy ON shared_files FOR ALL TO authenticated, anon USING (true);
CREATE POLICY shared_texts_policy ON shared_texts FOR ALL TO authenticated, anon USING (true);
CREATE POLICY network_connections_policy ON network_connections FOR ALL TO authenticated, anon USING (true);

-- Note: The edge functions code should be copied from the respective files:
-- 1. supabase/functions/get-ip/index.ts
-- 2. supabase/functions/upload-file/index.ts
-- Both functions have been updated to use IST timestamps with +05:30 timezone offset

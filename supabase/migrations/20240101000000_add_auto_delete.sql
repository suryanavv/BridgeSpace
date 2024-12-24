-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS cleanup_old_files_trigger ON shared_files;
DROP TRIGGER IF EXISTS check_file_limit_trigger ON shared_files;
DROP FUNCTION IF EXISTS check_old_files();
DROP FUNCTION IF EXISTS delete_old_files();
DROP FUNCTION IF EXISTS http_delete_old_files();
DROP FUNCTION IF EXISTS check_file_limit();

-- Enable the pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the cleanup tracking table
DROP TABLE IF EXISTS cleanup_last_check;
CREATE TABLE cleanup_last_check (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_check_time TIMESTAMP WITH TIME ZONE,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize the cleanup tracking table
INSERT INTO cleanup_last_check (id, last_check_time) 
VALUES (1, NOW() AT TIME ZONE 'UTC')
ON CONFLICT (id) DO UPDATE 
SET last_check_time = NOW() AT TIME ZONE 'UTC';

-- Create a function to check file limit
CREATE FUNCTION check_file_limit()
RETURNS trigger AS $$
DECLARE
    file_count INTEGER;
BEGIN
    -- Count total files
    SELECT COUNT(*) INTO file_count FROM shared_files;
    
    -- If this is an INSERT and we're at the limit
    IF TG_OP = 'INSERT' AND file_count >= 50 THEN
        RAISE EXCEPTION 'Maximum file limit (50) reached. Please delete some files before uploading more.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete old files
CREATE FUNCTION delete_old_files() 
RETURNS json AS $$
DECLARE
    file_record RECORD;
    deleted_files INTEGER := 0;
    failed_deletes INTEGER := 0;
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
BEGIN
    start_time := NOW();
    
    -- Select files older than 7 days (using UTC time)
    FOR file_record IN 
        SELECT id, name, created_at AT TIME ZONE 'UTC' as utc_created_at
        FROM shared_files 
        WHERE created_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
    LOOP
        BEGIN
            -- Delete from storage first
            DELETE FROM storage.objects 
            WHERE bucket_id = 'shared-files' 
            AND name LIKE file_record.id || '.%';

            -- Then delete from database
            DELETE FROM shared_files WHERE id = file_record.id;
            
            deleted_files := deleted_files + 1;
            
            -- Log deletion for verification (in UTC)
            RAISE NOTICE 'Deleted file: % (ID: %) created at %', 
                file_record.name, 
                file_record.id, 
                file_record.utc_created_at;
                
        EXCEPTION WHEN OTHERS THEN
            failed_deletes := failed_deletes + 1;
            RAISE NOTICE 'Failed to delete file: % (ID: %)', file_record.name, file_record.id;
        END;
    END LOOP;
    
    end_time := NOW();
    
    -- Return execution summary
    RETURN json_build_object(
        'success', true,
        'deleted_count', deleted_files,
        'failed_count', failed_deletes,
        'execution_time_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
        'started_at', start_time,
        'completed_at', end_time
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to check and delete old files
CREATE FUNCTION check_old_files()
RETURNS trigger AS $$
DECLARE
    last_check TIMESTAMP WITH TIME ZONE;
    now_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the current time in UTC
    now_time := NOW() AT TIME ZONE 'UTC';
    
    -- Get the last check time
    SELECT last_check_time INTO last_check 
    FROM cleanup_last_check 
    WHERE id = 1;
    
    -- If no last check or it's been more than 1 hour since last check
    IF last_check IS NULL OR now_time - last_check > INTERVAL '1 hour' THEN
        -- Run the cleanup
        PERFORM delete_old_files();
        
        -- Update the last check time
        UPDATE cleanup_last_check 
        SET last_check_time = now_time 
        WHERE id = 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for file limit check
CREATE TRIGGER check_file_limit_trigger
    BEFORE INSERT ON shared_files
    FOR EACH ROW
    EXECUTE FUNCTION check_file_limit();

-- Create the trigger for old file cleanup
CREATE TRIGGER cleanup_old_files_trigger
    AFTER INSERT OR DELETE OR UPDATE ON shared_files
    FOR EACH STATEMENT
    EXECUTE FUNCTION check_old_files();

-- Drop existing policies
DROP POLICY IF EXISTS "Enable deletion of old files" ON shared_files;
DROP POLICY IF EXISTS "Allow anonymous delete_old_files" ON shared_files;
DROP POLICY IF EXISTS "Enable deletion of all files" ON shared_files;

-- Add RLS policies to allow deletion
DO $$ 
BEGIN
    -- Policy for old files
    CREATE POLICY "Enable deletion of old files" ON shared_files
        FOR DELETE
        USING (created_at < (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days');

    -- Policy for manual deletion of any file
    CREATE POLICY "Enable deletion of all files" ON shared_files
        FOR DELETE
        USING (true);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to create policy: %', SQLERRM;
END $$;

-- Add a comment to explain what this migration does
COMMENT ON FUNCTION delete_old_files() IS 'Deletes files older than 7 days and returns execution summary';
COMMENT ON FUNCTION check_old_files() IS 'Trigger function to check and delete old files';
COMMENT ON FUNCTION check_file_limit() IS 'Ensures the total number of files does not exceed 50';

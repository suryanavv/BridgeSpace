-- Check if our functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('delete_old_files', 'check_old_files');

-- Check if our trigger exists
SELECT 
    tgname AS trigger_name,
    tgtype,
    tgenabled,
    tgisinternal
FROM pg_trigger
WHERE tgname = 'cleanup_old_files_trigger';

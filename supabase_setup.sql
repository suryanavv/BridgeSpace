-- BridgeSpace Supabase Setup
-- This file contains all the necessary SQL commands to recreate the Supabase project
-- Run these commands in the Supabase SQL Editor in the order they appear

-- =============================================
-- DATABASE TABLES
-- =============================================

-- Create network_connections table
CREATE TABLE IF NOT EXISTS network_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ DEFAULT now()
);

-- Create shared_texts table
CREATE TABLE IF NOT EXISTS shared_texts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  private_space_key TEXT,
  shared_at TIMESTAMPTZ DEFAULT now()
);

-- Create shared_files table
CREATE TABLE IF NOT EXISTS shared_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  size INT8 NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  network_prefix TEXT NOT NULL,
  private_space_key TEXT,
  shared_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create shared_files storage bucket
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO storage.buckets (id, name, public)
VALUES ('shared_files', 'shared_files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage bucket policy to allow public access to files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT
USING (bucket_id = 'shared_files');

-- Allow anyone to upload files
CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shared_files');

-- Allow deletion of files
CREATE POLICY "Anyone can delete" ON storage.objects FOR DELETE
USING (bucket_id = 'shared_files');

-- =============================================
-- POSTGRESQL FUNCTIONS
-- =============================================

-- Function to extract storage path from URL
CREATE OR REPLACE FUNCTION get_storage_path_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  path TEXT;
BEGIN
  -- Extract path after 'shared_files/'
  IF url LIKE '%/shared_files/%' THEN
    path := substring(url FROM '.*?/shared_files/(.*)$');
    RETURN path;
  -- Handle object storage format
  ELSIF url LIKE '%/object/shared_files/%' THEN
    path := substring(url FROM '.*?/object/shared_files/(.*)$');
    RETURN path;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Function to delete shared file entry
CREATE OR REPLACE FUNCTION delete_shared_file_entry(file_url TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shared_files
  WHERE url = file_url
  RETURNING 1 INTO deleted_count;
  
  RETURN COALESCE(deleted_count, 0);
END;
$$;

-- Function to clean up old files (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_files()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  file_record RECORD;
  storage_path TEXT;
  deleted_count INTEGER := 0;
  error_count INTEGER := 0;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  cutoff_date TIMESTAMPTZ := now() - INTERVAL '7 days';
BEGIN
  start_time := clock_timestamp();
  
  -- Log start of cleanup
  RAISE NOTICE 'Starting cleanup of files older than %', cutoff_date;
  
  -- First, identify and process files to delete
  FOR file_record IN 
    SELECT id, url, name, shared_at
    FROM shared_files
    WHERE shared_at < cutoff_date
    LIMIT 1000 -- Process in batches to avoid timeout
  LOOP
    BEGIN
      -- Extract storage path from URL
      storage_path := get_storage_path_from_url(file_record.url);
      
      IF storage_path IS NOT NULL THEN
        -- Delete from storage.objects
        DELETE FROM storage.objects
        WHERE name = storage_path AND bucket_id = 'shared_files';
        
        -- Delete from shared_files table
        DELETE FROM shared_files WHERE id = file_record.id;
        
        deleted_count := deleted_count + 1;
        RAISE NOTICE 'Deleted file: % (ID: %, Path: %)', file_record.name, file_record.id, storage_path;
      ELSE
        RAISE NOTICE 'Could not determine storage path for file: % (ID: %)', file_record.name, file_record.id;
        error_count := error_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error deleting file % (ID: %): %', file_record.name, file_record.id, SQLERRM;
      error_count := error_count + 1;
    END;
  END LOOP;
  
  -- Clean up old shared texts
  DELETE FROM shared_texts
  WHERE shared_at < cutoff_date;
  
  end_time := clock_timestamp();
  
  -- Log completion
  RAISE NOTICE 'Cleanup completed. Deleted % files with % errors in % seconds', 
    deleted_count, error_count, EXTRACT(EPOCH FROM (end_time - start_time));
 END;
$$;

-- =============================================
-- ROW-LEVEL SECURITY POLICIES
-- =============================================

-- Enable Row Level Security on tables
ALTER TABLE shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_connections ENABLE ROW LEVEL SECURITY;

-- Policies for shared_files
DROP POLICY IF EXISTS "SELECT - Access by network or private key" ON shared_files;
CREATE POLICY "SELECT - Access by network or private key" ON shared_files
FOR SELECT TO public
USING (
  (network_prefix = current_setting('request.headers.x-network-prefix', true)) OR
  (private_space_key = current_setting('request.headers.x-private-space-key', true))
);

DROP POLICY IF EXISTS "INSERT - Anyone can insert" ON shared_files;
CREATE POLICY "INSERT - Anyone can insert" ON shared_files
FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "DELETE - Allow delete by network or key" ON shared_files;
CREATE POLICY "DELETE - Allow delete by network or key" ON shared_files
FOR DELETE TO public
USING (
  (network_prefix = current_setting('request.headers.x-network-prefix', true)) OR
  (private_space_key = current_setting('request.headers.x-private-space-key', true))
);

-- Policies for shared_texts
DROP POLICY IF EXISTS "SELECT - Access by network or private key" ON shared_texts;
CREATE POLICY "SELECT - Access by network or private key" ON shared_texts
FOR SELECT TO public
USING (
  (network_prefix = current_setting('request.headers.x-network-prefix', true)) OR
  (private_space_key = current_setting('request.headers.x-private-space-key', true))
);

DROP POLICY IF EXISTS "INSERT - Anyone can insert" ON shared_texts;
CREATE POLICY "INSERT - Anyone can insert" ON shared_texts
FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "UPDATE - Allow updates by network or key" ON shared_texts;
CREATE POLICY "UPDATE - Allow updates by network or key" ON shared_texts
FOR UPDATE TO public
USING (
  (network_prefix = current_setting('request.headers.x-network-prefix', true)) OR
  (private_space_key = current_setting('request.headers.x-private-space-key', true))
);

-- Policies for network_connections
DROP POLICY IF EXISTS "Public access" ON network_connections;
CREATE POLICY "Public access" ON network_connections
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "Insert access" ON network_connections;
CREATE POLICY "Insert access" ON network_connections
FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Update access" ON network_connections;
CREATE POLICY "Update access" ON network_connections
FOR UPDATE TO public
USING (true);

-- =============================================
-- SCHEDULED JOBS (using pg_cron)
-- =============================================

-- Enable pg_cron extension (requires superuser privileges)
-- This may need to be done by Supabase support if you don't have superuser access
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup job at 00:00 IST (18:30 UTC)
-- Note: You may need to adjust the time based on your requirements
SELECT cron.schedule(
  'cleanup-old-files-daily',  -- unique job name
  '30 18 * * *',              -- cron schedule (18:30 UTC daily)
  $$SELECT cleanup_old_files()$$  -- SQL command to execute
);

-- =============================================
-- EDGE FUNCTIONS SETUP
-- =============================================

-- Note: Edge functions cannot be created directly via SQL.
-- You'll need to create these manually in the Supabase dashboard or using the Supabase CLI.
-- Below are the instructions for setting up the required edge functions:

/*
1. Create an edge function named 'get-ip' with the following code:

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get IP from request headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     '0.0.0.0'
    
    // Create a Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Calculate network prefix
    const networkPrefix = clientIP.split('.').slice(0, 3).join('.')
    
    // Check if this IP exists in the database
    const { data: existingIP, error: fetchError } = await supabase
      .from('network_connections')
      .select('*')
      .eq('ip_address', clientIP)
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching IP:', fetchError)
    }
    
    // Update or insert the IP
    if (existingIP) {
      // Update last active timestamp
      const { error: updateError } = await supabase
        .from('network_connections')
        .update({ last_active: new Date().toISOString() })
        .eq('id', existingIP.id)
      
      if (updateError) {
        console.error('Error updating IP record:', updateError)
      }
    } else {
      // Insert new IP record
      const { error: insertError } = await supabase
        .from('network_connections')
        .insert({
          ip_address: clientIP,
          network_prefix: networkPrefix,
        })
      
      if (insertError) {
        console.error('Error inserting IP record:', insertError)
      }
    }
    
    // Return the IP and network prefix to the client
    return new Response(
      JSON.stringify({ 
        ip: clientIP, 
        networkPrefix 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    
    return new Response(
      JSON.stringify({ error: 'Failed to get IP address' }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  }
})

2. Create an edge function named 'upload-file' with the following code:

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get form data with the file and network prefix
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const networkPrefix = formData.get("networkPrefix") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file uploaded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!networkPrefix) {
      return new Response(
        JSON.stringify({ error: "Network prefix is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing file:", file.name, "size:", file.size, "type:", file.type);

    // Sanitize file name to avoid issues with special characters
    const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, "");
    const fileExt = sanitizedFileName.split(".").pop() || "";
    const filePath = `${networkPrefix}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

    // Upload file to storage
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from("shared_files")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to storage", details: storageError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from("shared_files")
      .getPublicUrl(filePath);

    // Insert file metadata into database
    const { data: fileData, error: dbError } = await supabase
      .from("shared_files")
      .insert({
        name: sanitizedFileName,
        size: file.size,
        type: file.type,
        url: publicUrl,
        network_prefix: networkPrefix,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save file metadata", details: dbError }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Return success with file data
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "File uploaded successfully", 
        file: fileData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
*/

-- =============================================
-- REALTIME SETUP
-- =============================================

-- Enable realtime for shared_files and shared_texts tables
ALTER PUBLICATION supabase_realtime ADD TABLE shared_files;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_texts;

-- =============================================
-- ENVIRONMENT VARIABLES
-- =============================================

/*
Make sure to set the following environment variables in your new Supabase project:

1. In the Supabase dashboard:
   - No specific environment variables needed in the dashboard

2. In your application:
   - VITE_SUPABASE_URL: Your Supabase project URL
   - VITE_SUPABASE_ANON_KEY: Your Supabase project anonymous key
*/

-- =============================================
-- SETUP INSTRUCTIONS
-- =============================================

/*
To recreate your Supabase project:

1. Create a new Supabase project from the dashboard

2. Run the SQL commands in this file in the SQL Editor in the following order:
   - Database Tables section
   - Storage Buckets section
   - PostgreSQL Functions section
   - Row-Level Security Policies section
   - Scheduled Jobs section (may require Supabase support)
   - Realtime Setup section

3. Create the Edge Functions manually:
   - Go to Edge Functions in the Supabase dashboard
   - Create new functions named 'get-ip' and 'upload-file'
   - Copy the code provided in the Edge Functions Setup section

4. Update your application's environment variables with the new Supabase URL and anon key

5. Deploy your application with the updated environment variables
*/

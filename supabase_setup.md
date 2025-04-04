# BridgeSpace Supabase Setup Guide

This document provides a comprehensive guide to setting up the Supabase backend for the BridgeSpace application. Use this guide if you need to recreate your Supabase project from scratch.

## Overview

The BridgeSpace application uses Supabase for:
- Database tables for storing file metadata and shared text
- Storage buckets for file uploads
- Edge functions for IP detection and file uploads
- PostgreSQL functions for file cleanup (using IST timezone)
- Row-Level Security (RLS) policies
- Scheduled jobs for maintenance (running at midnight IST)
- Automatic cleanup of files older than 2 days

All timestamps in the application are stored in Indian Standard Time (IST) with +05:30 timezone offset.

## Setup Instructions

### 1. Create a New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.io/)
2. Click "New Project"
3. Enter project details and create the project
4. Note your project URL and anon key for later use

### 2. Database Setup

Run the SQL commands from the `supabase_setup.sql` file in the SQL Editor in the Supabase dashboard. The file contains all necessary commands to create:

- Tables: `network_connections`, `shared_texts`, `shared_files`
- PostgreSQL functions: `get_storage_path_from_url`, `delete_shared_file_entry`, `cleanup_old_files` (configured to use IST timezone)
- File limit functions: `check_file_size_limit`, `check_file_count_limit`
- Row-Level Security policies
- Scheduled jobs (configured to run at midnight IST, which is 18:30 UTC)

Additionally, run the migration scripts:
- `20240701000002_update_cleanup_and_limits.sql` to update the cleanup function to use a 2-day expiration period instead of 7 days, and to add the file size and count limit functions.
- `20240804000001_fix_cleanup_function_timezone.sql` and `20240804000002_fix_storage_delete_method.sql` to ensure proper timezone handling and storage object deletion in the cleanup function.

### 3. Storage Setup

The SQL file includes commands to create the `shared_files` storage bucket with appropriate permissions. After running these commands, verify in the Storage section of the Supabase dashboard that the bucket was created correctly.

### 4. Edge Functions Setup

Create the following edge functions manually in the Supabase dashboard:

#### get-ip
This function retrieves the client's IP address and manages network connections. It stores timestamps in Indian Standard Time (IST) format with +05:30 timezone offset.

1. Go to Edge Functions in the Supabase dashboard
2. Click "Create a new function"
3. Name it "get-ip"
4. Copy the code from the Edge Functions section in the SQL file

#### upload-file
This function handles file uploads to the storage bucket. It stores timestamps in Indian Standard Time (IST) format with +05:30 timezone offset.

1. Create another edge function named "upload-file"
2. Copy the code from the SQL file

### 5. Realtime Setup

Enable realtime for the tables by running the commands in the Realtime Setup section of the SQL file.

### 6. Environment Variables

Update your application with the new Supabase URL and anon key:

```
VITE_SUPABASE_URL=your-new-project-url
VITE_SUPABASE_ANON_KEY=your-new-anon-key
```

## Database Schema

### network_connections
- `id`: UUID (Primary Key)
- `ip_address`: TEXT
- `network_prefix`: TEXT
- `created_at`: TIMESTAMPTZ (stored in IST with +05:30 timezone offset)
- `last_active`: TIMESTAMPTZ (stored in IST with +05:30 timezone offset)

### shared_texts
- `id`: UUID (Primary Key)
- `content`: TEXT
- `network_prefix`: TEXT
- `private_space_key`: TEXT (nullable)
- `shared_at`: TIMESTAMPTZ (stored in IST with +05:30 timezone offset)

### shared_files
- `id`: UUID (Primary Key)
- `name`: TEXT
- `size`: INT8
- `type`: TEXT
- `url`: TEXT
- `network_prefix`: TEXT
- `private_space_key`: TEXT (nullable)
- `shared_at`: TIMESTAMPTZ (stored in IST with +05:30 timezone offset)

## Features

### Private Spaces
The application supports private spaces using a secret key. Files and texts can be shared within these private spaces, accessible only to users with the correct key.

### Automatic Cleanup
A scheduled job runs daily at midnight IST (18:30 UTC) to clean up files and texts older than 2 days, preventing storage bloat. The cleanup function uses Indian Standard Time (IST) timezone for determining which files to delete.

### File Limits
- Maximum file size: 50MB per file
- Maximum number of files: 20 files per network or private space

### Network-Based Sharing
Users on the same network can share files and texts without authentication, using their network prefix as an identifier.

## Troubleshooting

### Scheduled Jobs
If the scheduled job for cleanup doesn't work, you may need to contact Supabase support to enable the pg_cron extension with superuser privileges. The cleanup job is scheduled to run at midnight IST (18:30 UTC) using the cron expression '30 18 * * *'.

### RLS Policies
If you encounter permission issues, verify that the RLS policies are correctly set up and that your application is sending the appropriate headers for network prefix and private space key.

### Edge Functions
If edge functions fail, check the logs in the Supabase dashboard and ensure that the environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are correctly set.
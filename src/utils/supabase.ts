import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://uqvbvkhiycrkvimvthyv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdmJ2a2hpeWNya3ZpbXZ0aHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzY4MTAsImV4cCI6MjA1MDAxMjgxMH0.6jYsXvA1M1LeN1jS4brX-rBP6srXXJ9s7-gT-Vz9Jt4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Upload file edge function
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

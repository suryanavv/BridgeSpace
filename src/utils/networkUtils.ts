// Network validation utility functions
import { supabase } from "@/integrations/supabase/client";

// Define common response types
export type FileResponse = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  shared_at: string;
  network_prefix: string;
  private_space_key?: string;
};

export type TextResponse = {
  id: string;
  content: string;
  shared_at: string;
  network_prefix?: string;
  private_space_key?: string;
};

// Track the current private space key
let currentPrivateSpaceKey: string | null = null;

/**
 * Sets the private space key for use in subsequent API calls
 * @param key The private space key to set or null to clear
 */
export const setPrivateSpaceKey = (key: string | null) => {
  currentPrivateSpaceKey = key;
};

/**
 * Gets the current private space key
 * @returns The current private space key or null if not set
 */
export const getPrivateSpaceKey = (): string | null => {
  return currentPrivateSpaceKey;
};

/**
 * Fetches shared files for the current network or private space
 * @param privateSpaceKey - Optional private space key for fetching from private spaces
 * @returns Promise that resolves to an array of shared files
 */
export const fetchSharedFiles = async (privateSpaceKey?: string): Promise<FileResponse[]> => {
  // Update the current private space key
  if (privateSpaceKey) {
    setPrivateSpaceKey(privateSpaceKey);
  } else {
    setPrivateSpaceKey(null);
  }
  
  // Simplifying to avoid type errors
  try {
    if (privateSpaceKey) {
      const response = await supabase
        .from('shared_files')
        .select()
        .eq('private_space_key', privateSpaceKey)
        .order('shared_at', { ascending: false })
        .limit(50);

      if (response.error) throw response.error;
      
      // Ensure network_prefix is not null or undefined
      const files = (response.data || []).map(file => ({
        ...file,
        network_prefix: file.network_prefix || ''
      }));
      
      return files;
    } else {
      const networkPrefix = getCachedNetworkPrefix();
      if (!networkPrefix) return [];

      const response = await supabase
        .from('shared_files')
        .select()
        .eq('network_prefix', networkPrefix)
        .order('shared_at', { ascending: false })
        .limit(50);

      if (response.error) throw response.error;
      return response.data || [];
    }
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
};

/**
 * Fetches shared texts from the database for the current network or private space
 * @param privateSpaceKey - Optional private space key for fetching from private spaces
 * @returns Promise that resolves to an array of shared texts
 */
export const fetchSharedTexts = async (privateSpaceKey?: string): Promise<TextResponse[]> => {
  // Update the current private space key
  if (privateSpaceKey) {
    setPrivateSpaceKey(privateSpaceKey);
  } else {
    setPrivateSpaceKey(null);
  }
  
  // Simplifying to avoid type errors
  try {
    if (privateSpaceKey) {
      const response = await supabase
        .from('shared_texts')
        .select()
        .eq('private_space_key', privateSpaceKey)
        .order('shared_at', { ascending: false })
        .limit(10);

      if (response.error) throw response.error;
      return response.data || [];
    } else {
      const networkPrefix = getCachedNetworkPrefix();
      if (!networkPrefix) return [];

      const response = await supabase
        .from('shared_texts')
        .select()
        .eq('network_prefix', networkPrefix)
        .order('shared_at', { ascending: false })
        .limit(10);

      if (response.error) throw response.error;
      return response.data || [];
    }
  } catch (error) {
    console.error('Error fetching texts:', error);
    return [];
  }
};

/**
 * Uploads a file to Supabase storage and saves metadata
 * @param file The file to upload
 * @param privateSpaceKey Optional private space key to associate with the file
 * @returns Promise that resolves to file metadata
 */
export const uploadFile = async (file: File, privateSpaceKey?: string): Promise<FileResponse> => {
  // Validate network prefix or private space key
  const networkPrefix = privateSpaceKey ? null : getCachedNetworkPrefix();
  if (!networkPrefix && !privateSpaceKey) {
    throw new Error('Network prefix or private space key not available. Please try again.');
  }

  // Sanitize file name to prevent issues
  const sanitizedFileName = sanitizeFileName(file.name);
  const uniqueFileName = `${Date.now()}_${sanitizedFileName}`;

  try {
    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shared_files')
      .upload(`public/${uniqueFileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('shared_files')
      .getPublicUrl(`public/${uniqueFileName}`);

    // Insert metadata into database
    const { data: fileData, error: dbError } = await supabase
      .from('shared_files')
      .insert({
        name: sanitizedFileName,
        size: file.size,
        type: file.type,
        url: urlData.publicUrl,
        network_prefix: networkPrefix || '', // Ensure network_prefix is never null
        private_space_key: privateSpaceKey,
        shared_at: getISTTimestamp()
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return fileData as FileResponse;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

/**
 * Saves shared text to the database
 * @param content The text content to save
 * @param privateSpaceKey Optional private space key to associate with the text
 * @returns Promise that resolves to saved text metadata
 */
export const saveSharedText = async (content: string, privateSpaceKey?: string): Promise<TextResponse> => {
  const networkPrefix = privateSpaceKey ? null : getCachedNetworkPrefix();
  if (!networkPrefix && !privateSpaceKey) {
    throw new Error('Network prefix or private space key not available. Please try again.');
  }

  try {
    // First try to get existing text for this network or private space
    let query = supabase
      .from('shared_texts')
      .select('id');
    
    // Add the proper filter based on whether we're in a private space or network
    if (privateSpaceKey) {
      query = query.eq('private_space_key', privateSpaceKey);
    } else {
      query = query.eq('network_prefix', networkPrefix);
    }
    
    // Execute the query
    const { data: existingData, error: fetchError } = await query;
    
    // If there's an error other than "not found", throw it
    if (fetchError && fetchError.code !== 'PGNF') {
      throw fetchError;
    }
    
    // Check if we found any existing texts
    if (existingData && existingData.length > 0) {
      // Update the first existing text
      const existingId = existingData[0].id;
      const { data: updatedData, error: updateError } = await supabase
        .from('shared_texts')
        .update({
          content,
          shared_at: getISTTimestamp()
        })
        .eq('id', existingId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      return updatedData as TextResponse;
    } else {
      // Insert new text
      const { data: newData, error: insertError } = await supabase
        .from('shared_texts')
        .insert({
          content,
          network_prefix: networkPrefix || '',
          private_space_key: privateSpaceKey,
          shared_at: getISTTimestamp()
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newData as TextResponse;
    }
  } catch (error) {
    console.error('Error saving text:', error);
    throw error;
  }
};

// Helper function to get IST timestamp in ISO 8601 format
const getISTTimestamp = (): string => {
  // Create a date object
  const date = new Date();
  
  // Adjust for IST timezone (UTC+5:30)
  // IST is 5 hours and 30 minutes ahead of UTC
  const istTime = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
  
  // Return in ISO 8601 format that PostgreSQL accepts
  return istTime.toISOString();
};

// Helper function to sanitize file name
const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^\x00-\x7F]/g, "");
};

// Store the client IP once it's fetched to avoid changing values
let cachedClientIP: string | null = null;
let cachedNetworkPrefix: string | null = null;

/**
 * Gets the client's real IP address using the Supabase edge function
 * @returns Promise that resolves to the client's IP address
 */
export const getClientIP = async (): Promise<string> => {
  // Return cached IP if available
  if (cachedClientIP) {
    return Promise.resolve(cachedClientIP);
  }
  
  try {
    // Call the edge function to get the real IP
    const { data, error } = await supabase.functions.invoke('get-ip', {
      method: 'GET',
    });
    
    if (error) {
      console.error('Error getting IP from edge function:', error);
      throw new Error('Failed to get IP address');
    }
    
    if (data && data.ip) {
      cachedClientIP = data.ip;
      cachedNetworkPrefix = getNetworkPrefix(data.ip);
      return data.ip;
    }
    
    throw new Error('Invalid response from IP service');
  } catch (error) {
    console.error('Failed to get client IP:', error);
    
    // Fallback to the simulation for development/testing purposes
    console.warn('Using fallback simulated IP address');
    if (!cachedClientIP) {
      cachedClientIP = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      cachedNetworkPrefix = getNetworkPrefix(cachedClientIP);
    }
    
    return cachedClientIP;
  }
};

/**
 * Gets the network prefix of the cached IP
 * This allows getting the network prefix without making another API call
 * @returns The network prefix or empty string if IP hasn't been fetched
 */
export const getCachedNetworkPrefix = (): string => {
  return cachedNetworkPrefix || '';
};

/**
 * Extracts the network prefix from an IP address
 * @param ip - The full IP address
 * @param segments - Number of segments to include in the network prefix (default: 3)
 * @returns The network prefix
 */
export const getNetworkPrefix = (ip: string, segments: number = 3): string => {
  if (!ip) return '';
  const parts = ip.split('.');
  return parts.slice(0, segments).join('.');
};

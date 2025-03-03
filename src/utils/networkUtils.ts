
// Network validation utility functions
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Determines if two IP addresses are on the same network
 * @param ip1 - First IP address
 * @param ip2 - Second IP address
 * @param segments - Number of segments to compare (default: 3)
 * @returns Boolean indicating if IPs are on the same network
 */
export const onSameNetwork = (ip1: string, ip2: string, segments: number = 3): boolean => {
  return getNetworkPrefix(ip1, segments) === getNetworkPrefix(ip2, segments);
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
 * Uploads a file to Supabase storage and saves metadata to database
 * @param file - The file to upload
 * @returns Promise that resolves to the uploaded file data
 */
// Helper function to get IST timestamp
const getISTTimestamp = (): string => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  return new Date().toLocaleString('en-IN', options);
};

export const uploadFile = async (file: File): Promise<any> => {
  const networkPrefix = getCachedNetworkPrefix();
  if (!networkPrefix) {
    throw new Error('Network prefix not available. Please try again.');
  }

  try {
    // Create unique file path with IST timestamp
    const fileExt = file.name.split('.').pop() || '';
    const timestamp = getISTTimestamp();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, "");
    const filePath = `${networkPrefix}/${timestamp}_${randomString}.${fileExt}`;

    // Upload file directly to Supabase storage instead of using edge function
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('shared_files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      throw new Error('Failed to upload file');
    }

    // Get public URL for the file
    const { data: { publicUrl } } = supabase
      .storage
      .from('shared_files')
      .getPublicUrl(filePath);

    // Save file metadata to database with IST timestamp
    const { data: fileData, error: dbError } = await supabase
      .from('shared_files')
      .insert({
        name: sanitizedFileName,
        size: file.size,
        type: file.type,
        url: publicUrl,
        network_prefix: networkPrefix,
        shared_at: getISTTimestamp()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save file metadata');
    }

    return fileData;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

/**
 * Saves shared text to database
 * @param content - The text content to save
 * @returns Promise that resolves to the saved text data
 */
export const saveSharedText = async (content: string): Promise<any> => {
  const networkPrefix = getCachedNetworkPrefix();
  if (!networkPrefix) {
    throw new Error('Network prefix not available. Please try again.');
  }

  const { data, error } = await supabase
    .from('shared_texts')
    .insert({
      content,
      network_prefix: networkPrefix,
      shared_at: getISTTimestamp()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving text:', error);
    throw new Error('Failed to save text');
  }

  return data;
};

/**
 * Fetches shared files for the current network
 * @returns Promise that resolves to an array of shared files
 */
export const fetchSharedFiles = async (): Promise<any[]> => {
  const networkPrefix = getCachedNetworkPrefix();
  if (!networkPrefix) {
    return [];
  }

  const { data, error } = await supabase
    .from('shared_files')
    .select('*')
    .eq('network_prefix', networkPrefix)
    .order('shared_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching shared files:', error);
    throw error;
  }

  // Filter out files that don't match the current network prefix
  const filteredData = data?.filter(file => file.network_prefix === networkPrefix) || [];
  return filteredData;
};

/**
 * Fetches shared texts for the current network
 * @returns Promise that resolves to an array of shared texts
 */
export const fetchSharedTexts = async (): Promise<any[]> => {
  const networkPrefix = getCachedNetworkPrefix();
  if (!networkPrefix) {
    return [];
  }

  const { data, error } = await supabase
    .from('shared_texts')
    .select('*')
    .eq('network_prefix', networkPrefix)
    .order('shared_at', { ascending: false });

  if (error) {
    console.error('Error fetching shared texts:', error);
    return [];
  }

  return data || [];
};

/**
 * Network validation mechanism explanation:
 * 
 * For a production implementation, the ideal mechanism would be:
 * 1. Server-side validation: When a client connects, the server captures their IP address
 * 2. Network prefix comparison: Server extracts the network prefix (typically first 3 octets)
 * 3. Access control: Only allow connections with matching network prefixes
 * 
 * Limitations of client-side validation:
 * - Browsers cannot directly access the full IP address due to security restrictions
 * - WebRTC can leak IP addresses but requires user permission and is not reliable
 * 
 * Alternative approaches:
 * - Local server discovery using mDNS/Bonjour/Zeroconf
 * - WebRTC for peer-to-peer communication (but still needs a matching mechanism)
 * - QR code scanning to verify physical proximity
 */

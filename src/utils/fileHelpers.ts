import { supabase } from '@/utils/supabase';
import { NetworkUtils } from './network';
import { uuid } from './uuid';

export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  error?: string;
  url?: string;
}

export async function uploadFile(file: File, networkId: string): Promise<FileUploadResult> {
  try {
    const fileId = uuid.generate();
    const fileExt = file.name.split('.').pop();
    const filePath = `${fileId}.${fileExt}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('shared-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get file URL
    const { data: urlData } = await supabase.storage
      .from('shared-files')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) throw new Error('Failed to get file URL');

    // Create database entry with network ID
    const { error: dbError } = await supabase
      .from('shared_files')
      .insert([
        {
          id: fileId,
          name: file.name,
          type: file.type,
          url: urlData.publicUrl,
          network_id: networkId // Include network ID
        }
      ]);

    if (dbError) throw dbError;

    return { success: true };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

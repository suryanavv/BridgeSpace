
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { File, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFile } from '@/utils/networkUtils';
import { fetchSharedFiles } from '@/utils/networkUtils';

interface FileUploadProps {
  networkConnected: boolean;
  onFilesUploaded: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ networkConnected, onFilesUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = async (fileList: File[]) => {
    if (!networkConnected) {
      toast.error('Network disconnected', {
        description: 'Please connect to a network to share files.',
      });
      return;
    }
  
    setIsUploading(true);
    
    try {
      // Get current files in the network
      const existingFiles = await fetchSharedFiles();
      const remainingSlots = 50 - existingFiles.length;

      if (remainingSlots <= 0) {
        toast.error('Network storage full', {
          description: 'Maximum limit of 50 files reached. Please delete some files before uploading.',
        });
        return;
      }

      // Deduplicate files while maintaining order
      const seen = new Set();
      const uniqueFiles = fileList.filter(file => {
        const key = `${file.name}-${file.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Check if total files would exceed limit
      if (uniqueFiles.length > remainingSlots) {
        toast.error('Too many files', {
          description: `You can only upload ${remainingSlots} more file(s). Please select fewer files.`,
        });
        return;
      }
      
      // Upload files sequentially to maintain order
      const uploadedFiles = [];
      for (const file of uniqueFiles) {
        const fileData = await uploadFile(file);
        uploadedFiles.push(fileData);
      }
      
      onFilesUploaded(uniqueFiles);
      
      toast.success('Files shared', {
        description: `${uniqueFiles.length} file(s) are now available on your network.`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Failed to upload files. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      handleUpload(fileList);
    }
  }, [networkConnected]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      handleUpload(fileList);
    }
  }, [networkConnected]);

  return (
    <div className="glass-card rounded-lg p-6 animate-fade-in">
      <h2 className="text-lg font-medium mb-4">Share Files</h2>
      
      <div
        className={`drop-zone ${isDragging ? 'active' : ''} mb-4`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-4">
          {isUploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-center mb-1">Uploading files...</p>
              <p className="text-xs text-muted-foreground text-center">Please wait</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-center mb-2">
                Drag and drop files here, or{' '}
                <label className="text-primary cursor-pointer hover:underline">
                  browse
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={!networkConnected || isUploading}
                  />
                </label>
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Files will be shared with devices on your network
              </p>
            </>
          )}
        </div>
      </div>
      
      {!networkConnected && (
        <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded mt-2">
          Connect to a network to share files
        </div>
      )}
    </div>
  );
};

export default FileUpload;

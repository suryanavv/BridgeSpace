import React, { useState, useEffect, useRef } from 'react';
import { FileIcon, ImageIcon, FileTextIcon, Loader2Icon, RefreshCwIcon, DownloadIcon, TrashIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase';
import { format, addDays, formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCurrentNetworkId, initNetworkInfo } from '@/utils/supabase';
import { uploadFile } from '@/utils/fileHelpers';
import { NetworkUtils } from '@/utils/network';
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface FileItem {
  id: string;
  name: string;
  type: string;
  url: string;
  created_at: string;
  network_id?: string;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://bridgespace.vercel.app'
] as const;

const URL_PATTERN = new RegExp(
  '^https?:\\/\\/' + // Protocol
  '([a-zA-Z0-9-]+\\.)*' + // Subdomains
  '[a-zA-Z0-9-]+\\.' + // Domain
  '[a-zA-Z]{2,}' + // TLD
  '(\\/[^\\s]*)?$' // Path
);

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ALLOWED_ORIGINS.includes(url.origin as typeof ALLOWED_ORIGINS[number]);
  } catch {
    return false;
  }
}

interface MessageData {
  type: string;
  payload: unknown;
}

function handleMessage(event: MessageEvent) {
  if (!isValidOrigin(event.origin)) {
    console.warn('Blocked message from unauthorized origin:', event.origin);
    return;
  }

  try {
    const data = JSON.parse(event.data) as MessageData;
    
    if (!data || typeof data !== 'object' || !('type' in data)) {
      throw new Error('Invalid message format');
    }

    switch (data.type) {
      default:
        console.warn('Unhandled message type:', data.type);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

function sanitizeFileName(fileName: string): string {
  const name = fileName.replace(/^.*[\\\/]/, '');
  
  return name
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[.-]+|[.-]+$/g, '')
    .substring(0, 255);
}

const downloadFile = async (url: string, fileName: string) => {
  let blobUrl: string | null = null;
  
  try {
    if (!URL_PATTERN.test(url)) {
      throw new Error('Invalid file URL');
    }

    const fileUrl = new URL(url);
    const isAllowedDomain = ALLOWED_ORIGINS.some(origin => 
      fileUrl.origin === new URL(origin).origin
    );

    if (!isAllowedDomain) {
      throw new Error('File URL not allowed');
    }

    const sanitizedFileName = sanitizeFileName(fileName);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType) {
      throw new Error('No content type specified');
    }

    const blob = await response.blob();
    blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = sanitizedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download error:', error);
    toast.error('Failed to download file: ' + (error instanceof Error ? error.message : 'Unknown error'));
  } finally {
    if (blobUrl) {
      window.URL.revokeObjectURL(blobUrl);
    }
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const retryOperation = async <T,>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay);
    }
    throw error;
  }
};

// Add new interfaces for tracking upload progress
interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
}

interface FileWithHash {
  file: File;
  hash: string;
}

export const FileShare = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const MAX_FILES = 50;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_CONCURRENT_UPLOADS = 3; // Maximum concurrent uploads allowed
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [uploadQueue, setUploadQueue] = useState<FileWithHash[]>([]);
  const activeUploads = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadFiles();

    const channel = supabase
      .channel('public:shared_files')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'shared_files' },
        (payload: any) => {
          if (payload.new) {
            setFiles(prev => [payload.new as FileItem, ...prev]);
            toast.success(`New file shared: ${payload.new.name}`);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const getFileCount = async () => {
      const { count } = await supabase
        .from('shared_files')
        .select('*', { count: 'exact', head: true });
      setFileCount(count || 0);
    };

    getFileCount();
    
    const channel = supabase
      .channel('file_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_files' },
        () => getFileCount()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const detectedNetworkId = await NetworkUtils.detectNetwork();
        setNetworkId(detectedNetworkId);
      } catch (error) {
        console.error('Error initializing network:', error);
        toast.error("Failed to initialize network", {
          description: "Could not detect your network. Please try again."
        });
      }
    };
    init();
  }, []);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) {
        toast.error("Network not identified");
        return;
      }

      // Retry database operations
      const { data: dbFiles, error: dbError } = await retryOperation(async () => {
        return await supabase
          .from('shared_files')
          .select('*')
          .eq('network_id', currentNetworkId)
          .order('created_at', { ascending: false });
      });

      if (dbError) throw dbError;

      // Check for file locks to handle simultaneous uploads
      const accessibleFiles = await Promise.all(
        (dbFiles || []).map(async (file) => {
          try {
            // Check file lock
            const { data: lockData } = await supabase
              .from('file_locks')
              .select('*')
              .eq('file_id', file.id)
              .single();

            // If file is locked and lock is recent (within last minute)
            if (lockData && (Date.now() - new Date(lockData.locked_at).getTime()) < 60000) {
              return null; // Skip this file
            }

            const hasAccess = await NetworkUtils.validateFileAccess(file.network_id);
            return hasAccess ? file : null;
          } catch (error) {
            console.error('Error validating file access:', error);
            return null;
          }
        })
      );

      setFiles(accessibleFiles.filter((file): file is FileItem => file !== null));
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error("Failed to load shared files");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
    try {
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) {
        toast.error('Network not identified');
        return;
      }

      setDeletingFiles(prev => new Set(prev).add(file.id));
      
      const { error: dbError } = await supabase
        .from('shared_files')
        .delete()
        .eq('id', file.id)
        .eq('network_id', currentNetworkId);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error(`Failed to delete from database: ${dbError.message}`);
      }

      const { error: storageError } = await supabase.storage
        .from('shared-files')
        .remove([`${file.id}.${file.name.split('.').pop()}`]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        toast.warning('Note: File might persist in storage');
      }

      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted successfully');

    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file. Please try again.');
      loadFiles();
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
      setFileToDelete(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  // Add function to calculate file hash for deduplication
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Add function to check for duplicate files
  const isDuplicateFile = async (file: File): Promise<boolean> => {
    const hash = await calculateFileHash(file);
    const { data } = await supabase
      .from('shared_files')
      .select('id')
      .eq('file_hash', hash)
      .eq('network_id', networkId)
      .single();
    
    return !!data;
  };

  // Update handleFiles function to include deduplication and progress
  const handleFiles = async (uploadedFiles: File[]) => {
    if (!uploadedFiles.length) {
      toast.error("No files selected");
      return;
    }

    if (fileCount + uploadedFiles.length > MAX_FILES) {
      toast.error(`Cannot upload more than ${MAX_FILES} files. Please delete some files first.`);
      return;
    }

    setIsSharing(true);

    try {
      // Process files for deduplication
      const filesWithHash: FileWithHash[] = [];
      for (const file of uploadedFiles) {
        const hash = await calculateFileHash(file);
        const isDuplicate = await isDuplicateFile(file);
        
        if (isDuplicate) {
          toast.warning(`File "${file.name}" already exists`);
          continue;
        }
        
        filesWithHash.push({ file, hash });
      }

      setUploadQueue(prev => [...prev, ...filesWithHash]);
      processUploadQueue();
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process files');
    } finally {
      setIsSharing(false);
    }
  };

  // Add function to process upload queue
  const processUploadQueue = async () => {
    if (activeUploads.current.size >= MAX_CONCURRENT_UPLOADS) return;

    const currentQueue = [...uploadQueue];
    if (currentQueue.length === 0) return;

    const { file, hash } = currentQueue[0];
    setUploadQueue(currentQueue.slice(1));

    const uploadId = generateUUID();
    activeUploads.current.add(uploadId);

    setUploadProgress(prev => ({
      ...prev,
      [uploadId]: {
        id: uploadId,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      }
    }));

    try {
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) throw new Error('Network not identified');

      const sanitizedFile = new File([file], sanitizeFileName(file.name), {
        type: file.type,
        lastModified: file.lastModified
      });

      // Upload with progress tracking
      const result = await uploadFileWithProgress(sanitizedFile, currentNetworkId, hash, (progress) => {
        setUploadProgress(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress }
        }));
      });

      if (result.success) {
        setUploadProgress(prev => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: 'completed', progress: 100 }
        }));

        // Cleanup successful upload after animation
        setTimeout(() => {
          setUploadProgress(prev => {
            const { [uploadId]: _, ...rest } = prev;
            return rest;
          });
        }, 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error);
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], status: 'failed' }
      }));

      // Cleanup failed upload after showing error
      setTimeout(() => {
        setUploadProgress(prev => {
          const { [uploadId]: _, ...rest } = prev;
          return rest;
        });
      }, 5000);
    } finally {
      activeUploads.current.delete(uploadId);
      processUploadQueue(); // Process next in queue
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-6 h-6" />;
    if (type === 'application/pdf') return <FileTextIcon className="w-6 h-6" />;
    return <FileIcon className="w-6 h-6" />;
  };

  const handleDeleteAllFiles = async () => {
    try {
      setIsDeletingAll(true);
      
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) {
        throw new Error('Network not identified');
      }

      // Get all files for current network
      const { data: files, error: fetchError } = await supabase
        .from('shared_files')
        .select('id, name, type, url')
        .eq('network_id', currentNetworkId);
      
      if (fetchError) throw fetchError;

      if (!files || files.length === 0) {
        toast.info('No files to delete');
        return;
      }

      // Delete files from storage first
      const storagePromises = files.map(async (file) => {
        try {
          const fileExtension = file.name.split('.').pop();
          const storageFileName = `${file.id}.${fileExtension}`;
          
          const { error: storageError } = await supabase.storage
            .from('shared-files')
            .remove([storageFileName]);

          if (storageError) {
            console.warn(`Warning: Failed to delete ${file.name} from storage:`, storageError);
          }
        } catch (error) {
          console.warn(`Warning: Error processing ${file.name}:`, error);
        }
      });

      // Continue even if some storage deletions fail
      await Promise.allSettled(storagePromises);

      // Delete database records
      const { error: dbError } = await supabase
        .from('shared_files')
        .delete()
        .eq('network_id', currentNetworkId);

      if (dbError) throw dbError;

      toast.success(`Successfully deleted ${files.length} files`);
      loadFiles();
    } catch (error: any) {
      console.error('Error deleting all files:', error);
      toast.error(error.message || 'Failed to delete all files');
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllDialog(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      if (!file) return;
      
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) {
        toast.error('Network not identified');
        return;
      }

      // Keep only file size validation
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File too large. Maximum size is 100MB');
        return;
      }

      setIsSharing(true);
      // Rest of your upload logic...
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsSharing(false);
    }
  };

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup any temporary files or uploads
      Object.keys(uploadProgress).forEach(uploadId => {
        if (uploadProgress[uploadId].status === 'uploading') {
          // Cancel upload if possible
          // Cleanup temporary files
        }
      });
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Files</h2>
          <div className="flex items-center space-x-2">
            <Loader2Icon className="w-4 h-4 animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-2 py-3 border-b">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Files</h2>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col space-y-4 overflow-hidden">
        <div className="flex-none">
          <div
            className={`p-6 border-2 border-dashed rounded-lg ${
              isDragging ? 'border-primary bg-blue-50' : 'border-gray-300'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-2">
              {fileCount >= MAX_FILES && (
                <div className="text-red-500 text-sm mb-4">
                  Maximum file limit reached. Please delete some files before uploading more.
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-4">
                <label className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
                  <span className="mr-2">Choose Files</span>
                  <input
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                    disabled={fileCount >= MAX_FILES}
                    className="hidden"
                  />
                </label>
                
                <span className="text-gray-400 text-sm">
                  or drag and drop multiple files here
                </span>
              </div>

              <p className="text-xs text-gray-400">
                You can select multiple files at once
              </p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-none sticky top-0 bg-white px-2 py-2 border-b flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {files.length}/{MAX_FILES} files
              </span>
              <button
                onClick={() => setShowDeleteAllDialog(true)}
                className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                disabled={isDeletingAll}
              >
                {isDeletingAll ? (
                  <span className="flex items-center">
                    <div className="relative w-4 h-4 mr-2">
                      <div className="absolute inset-0 border-2 border-red-200 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-red-600 rounded-full animate-[spin_1s_linear_infinite] border-t-transparent"></div>
                    </div>
                    Deleting...
                  </span>
                ) : (
                  'Delete All'
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-start p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="text-gray-400 group-hover:text-gray-500 pt-1">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0 ml-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      <p>Uploaded {format(new Date(file.created_at), 'MMM d, yyyy h:mm a')}</p>
                      <p className="text-amber-600">
                        Will be deleted on {format(addDays(new Date(file.created_at), 7), 'MMM d, yyyy h:mm a')} ({formatDistanceToNow(addDays(new Date(file.created_at), 7), { addSuffix: true })})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        downloadFile(file.url, file.name);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      title="Download file"
                    >
                      <DownloadIcon className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => setFileToDelete(file)}
                      disabled={deletingFiles.has(file.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete file"
                    >
                      {deletingFiles.has(file.id) ? (
                        <Loader2Icon className="w-5 h-5 animate-spin" />
                      ) : (
                        <TrashIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isSharing && (
          <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-white/50">
            <div className="relative w-12 h-12 mb-3">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_1s_linear_infinite] border-t-transparent"></div>
            </div>
            <p className="text-gray-600 font-medium">Uploading, please wait...</p>
          </div>
        )}

        <AlertDialog open={fileToDelete !== null} onOpenChange={() => setFileToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete File</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{fileToDelete?.name}"? This action cannot be undone,
                and the file will be permanently removed from storage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => fileToDelete && handleDelete(fileToDelete)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showDeleteAllDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete All Files?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete all files? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteAllDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={isDeletingAll}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllFiles}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  disabled={isDeletingAll}
                >
                  {isDeletingAll ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add upload progress indicators */}
        {Object.values(uploadProgress).length > 0 && (
          <div className="fixed bottom-4 right-4 space-y-2">
            {Object.values(uploadProgress).map((upload) => (
              <div
                key={upload.id}
                className={cn(
                  "p-4 rounded-lg shadow-lg max-w-sm w-full",
                  upload.status === 'completed' ? 'bg-green-50' : 
                  upload.status === 'failed' ? 'bg-red-50' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate">{upload.fileName}</span>
                  {upload.status === 'failed' && (
                    <button
                      onClick={() => {
                        setUploadProgress(prev => {
                          const { [upload.id]: _, ...rest } = prev;
                          return rest;
                        });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      upload.status === 'completed' ? 'bg-green-500' :
                      upload.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                    )}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {upload.status === 'completed' ? 'Upload complete' :
                   upload.status === 'failed' ? 'Upload failed' :
                   `${Math.round(upload.progress)}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


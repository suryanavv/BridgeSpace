import React, { useState, useEffect } from 'react';
import { FileIcon, ImageIcon, FileTextIcon, Loader2Icon, RefreshCwIcon, DownloadIcon, TrashIcon } from 'lucide-react';
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

interface FileItem {
  id: string;
  name: string;
  type: string;
  url: string;
  created_at: string;
}

export const FileShare = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const MAX_FILES = 50;

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
      supabase.removeChannel(channel);
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
    
    // Subscribe to changes
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

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      
      // Get files from database
      const { data: dbFiles, error: dbError } = await supabase
        .from('shared_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      // Get files from storage
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('shared-files')
        .list();

      if (storageError) throw storageError;

      // Only keep files that exist in both database and storage
      const validFiles = (dbFiles || []).filter(dbFile => 
        storageFiles?.some(storageFile => 
          storageFile.name.startsWith(dbFile.id)
        )
      );

      setFiles(validFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load shared files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (JSON.stringify(data) !== JSON.stringify(files)) {
        setFiles(data || []);
        toast.success('Files refreshed successfully');
      } else {
        toast.info('Files are already up to date');
      }
    } catch (error) {
      console.error('Error refreshing files:', error);
      toast.error('Failed to refresh files');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
    try {
      setDeletingFiles(prev => new Set(prev).add(file.id));
      
      // Delete from database first
      const { error: dbError } = await supabase
        .from('shared_files')
        .delete()
        .eq('id', file.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error(`Failed to delete from database: ${dbError.message}`);
      }

      // Then delete from storage
      const { error: storageError } = await supabase.storage
        .from('shared-files')
        .remove([`${file.id}.${file.name.split('.').pop()}`]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Log error but continue since database record is deleted
        toast.warning('Note: File might persist in storage');
      }

      // Update local state
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted successfully');

    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file. Please try again.');
      // Refresh to show current state
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

  const handleFiles = async (uploadedFiles: File[]) => {
    setIsSharing(true);
    try {
      const newFiles = await Promise.all(uploadedFiles.map(async (file) => {
        const fileId = crypto.randomUUID();
        const fileExt = file.name.split('.').pop();
        const filePath = `${fileId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('shared-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('shared-files')
          .getPublicUrl(filePath);

        const fileItem = {
          id: fileId,
          name: file.name,
          type: file.type,
          url: publicUrl,
          created_at: new Date().toISOString(),
        };

        const { error: dbError } = await supabase
          .from('shared_files')
          .insert([fileItem]);

        if (dbError) throw dbError;

        return fileItem;
      }));

      setFiles(prev => [...newFiles, ...prev]);
      toast.success('Files shared successfully!');
    } catch (error) {
      console.error('Error sharing files:', error);
      toast.error('Failed to share files');
    } finally {
      setIsSharing(false);
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
      
      // First, get all file IDs and names
      const { data: files, error: fetchError } = await supabase
        .from('shared_files')
        .select('id, name');
      
      if (fetchError) {
        throw fetchError;
      }

      if (!files || files.length === 0) {
        toast.info('No files to delete');
        return;
      }

      // Delete from storage first
      for (const file of files) {
        const { error: storageError } = await supabase.storage
          .from('shared-files')
          .remove([`${file.id}.*`]);

        if (storageError) {
          console.error(`Error deleting file ${file.name} from storage:`, storageError);
        }
      }

      // Delete from database in batches
      for (const file of files) {
        const { error: dbError } = await supabase
          .from('shared_files')
          .delete()
          .eq('id', file.id);

        if (dbError) {
          console.error(`Error deleting file ${file.name} from database:`, dbError);
        }
      }

      toast.success(`Successfully deleted ${files.length} files`);
      loadFiles(); // Refresh the file list
    } catch (error: any) {
      console.error('Error deleting all files:', error);
      toast.error(error.message || 'Failed to delete all files');
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllDialog(false);
    }
  };

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
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Files</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isRefreshing}
            title="Refresh files"
          >
            <RefreshCwIcon 
              className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : 'hover:text-gray-700'}`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col space-y-4 overflow-hidden">
        {/* Upload Section - Always visible */}
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

        {/* Files List Section */}
        {files.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 bg-white px-2 py-3 border-b flex items-center justify-between">
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
            <div className="divide-y">
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
                      href={file.url}
                      download={file.name}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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

        {/* Delete Confirmation Dialog */}
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
      </div>
    </div>
  );
};
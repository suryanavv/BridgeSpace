
import React from 'react';
import { File as LucideFileIcon, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { FileIcon, ImageIcon, VideoIcon, FileTextIcon } from '@radix-ui/react-icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  shared_at: string;
}

interface SharedText {
  id: string;
  content: string;
  shared_at: string;
}

interface FileListProps {
  files: SharedFile[];
  onDownload?: (file: SharedFile) => void;
  onCopyText?: (text: SharedText) => void;
  onDeleteFile?: (file: SharedFile) => void;
  onDeleteAllFiles?: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const FileList: React.FC<FileListProps> = ({ 
  files,
  onDownload,
  onCopyText,
  onDeleteFile,
  onDeleteAllFiles,
  isLoading = false,
  onRefresh
}) => {
  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', options);
  };

  // Handle file deletion
  const handleDelete = async (file: SharedFile) => {
    if (!onDeleteFile) return;
    
    try {
      await onDeleteFile(file);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file', {
        description: error instanceof Error ? error.message : 'Unexpected error occurred'
      });
    }
  };

  // Handle file download
  const handleDownload = (file: SharedFile) => {
    if (onDownload) {
      onDownload(file);
    }
  };

  // Handle text copy
  const handleCopyText = (text: SharedText) => {
    if (onCopyText) {
      onCopyText(text);
    }
    
    navigator.clipboard.writeText(text.content)
      .then(() => {
        toast.success('Copied to clipboard', {
          description: 'Text has been copied to your clipboard.',
        });
      })
      .catch(() => {
        toast.error('Failed to copy', {
          description: 'Could not copy text to clipboard.',
        });
      });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    } else if (type.startsWith('video/')) {
      return <VideoIcon className="h-5 w-5 text-purple-500" />;
    } else if (type.startsWith('audio/')) {
      return <FileTextIcon className="h-5 w-5 text-pink-500" />;
    } else if (type.startsWith('text/')) {
      return <FileTextIcon className="h-5 w-5 text-green-500" />;
    } else if (type.includes('pdf')) {
      return <FileTextIcon className="h-5 w-5 text-red-500" />;
    } else {
      return <FileIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Move hasSharedItems definition here, before it's used
  // Simplified hasSharedItems check - if texts aren't being rendered, we could simplify this
  const hasSharedItems = files.length > 0;

  return (
    <div className="glass-card rounded-lg p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Shared on Your Network</h2>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !hasSharedItems ? (
        <div className="text-center py-8">
          <div className="flex justify-center mb-3 text-muted-foreground">
            <LucideFileIcon className="h-12 w-12 opacity-50" />
          </div>
          <h3 className="text-base font-medium mb-1">No shared files yet</h3>
          <p className="text-sm text-muted-foreground">
            Shared files will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="animate-slide-up">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium flex items-center">
                <LucideFileIcon className="h-4 w-4 mr-1" />
                Files ({files.length})
              </h3>
              {onDeleteAllFiles && files.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                    >
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Files</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete all files? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDeleteAllFiles}>Delete All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center p-3 border border-border rounded-md hover:bg-secondary/50 transition-colors"
                >
                  <div className="mr-3">{getFileIcon(file.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <span>{formatSize(file.size)}</span>
                      <span className="mx-1.5">•</span>
                      <span>{formatDate(file.shared_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {onDeleteFile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(file)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;

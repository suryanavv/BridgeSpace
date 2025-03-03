
import React from 'react';
import { File as FileIcon, FileText, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  texts: SharedText[];
  onDownload?: (file: SharedFile) => void;
  onCopyText?: (text: SharedText) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const FileList: React.FC<FileListProps> = ({ 
  files, 
  texts, 
  onDownload,
  onCopyText,
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

  // Truncate text for preview
  const truncateText = (text: string, maxLength = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
      return <div className={cn("file-icon", "before:bg-blue-500")}>IMG</div>;
    } else if (type.startsWith('video/')) {
      return <div className={cn("file-icon", "before:bg-purple-500")}>VID</div>;
    } else if (type.startsWith('audio/')) {
      return <div className={cn("file-icon", "before:bg-pink-500")}>AUD</div>;
    } else if (type.startsWith('text/')) {
      return <div className={cn("file-icon", "before:bg-green-500")}>TXT</div>;
    } else if (type.includes('pdf')) {
      return <div className={cn("file-icon", "before:bg-red-500")}>PDF</div>;
    } else {
      return <div className={cn("file-icon", "before:bg-gray-500")}>DOC</div>;
    }
  };

  const hasSharedItems = files.length > 0 || texts.length > 0;

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
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !hasSharedItems ? (
        <div className="text-center py-8">
          <div className="flex justify-center mb-3 text-muted-foreground">
            <FileIcon className="h-12 w-12 opacity-50" />
          </div>
          <h3 className="text-base font-medium mb-1">No shared items yet</h3>
          <p className="text-sm text-muted-foreground">
            Shared files and text will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {files.length > 0 && (
            <div className="animate-slide-up">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <FileIcon className="h-4 w-4 mr-1" />
                Files ({files.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => handleDownload(file)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {texts.length > 0 && (
            <div className="animate-slide-up delay-100">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                Text ({texts.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {texts.map((text) => (
                  <div
                    key={text.id}
                    className="p-3 border border-border rounded-md hover:bg-secondary/50 transition-colors"
                  >
                    <div className="text-sm">{truncateText(text.content)}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(text.shared_at)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyText(text)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileList;

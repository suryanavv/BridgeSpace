import React from "react";
import {
  File as LucideFileIcon,
  FileText,
  Download,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  FileIcon,
  ImageIcon,
  VideoIcon,
  FileTextIcon,
} from "@radix-ui/react-icons";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { FileResponse } from "@/utils/networkUtils";

interface SharedText {
  id: string;
  content: string;
  shared_at: string;
}

interface FileListProps {
  files: FileResponse[];
  texts?: SharedText[];
  onDownload?: (file: FileResponse) => void;
  onCopyText?: (text: SharedText) => void;
  onDeleteFile?: (file: FileResponse) => void;
  onDeleteAllFiles?: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const FileList: React.FC<FileListProps> = ({
  files,
  texts = [],
  onDownload,
  onCopyText,
  onDeleteFile,
  onDeleteAllFiles,
  isLoading = false,
  onRefresh,
}) => {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };

    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", options);
  };

  const getDaysRemaining = (dateStr: string): number => {
    const uploadDate = new Date(dateStr);
    const currentDate = new Date();
    const timeDiff =
      2 -
      Math.floor(
        (currentDate.getTime() - uploadDate.getTime()) / (1000 * 3600 * 24),
      );
    return timeDiff > 0 ? timeDiff : 0;
  };

  const getExpirationMessage = (
    dateStr: string,
  ): { message: string; className: string } => {
    const daysRemaining = getDaysRemaining(dateStr);

    if (daysRemaining === 0) {
      return {
        message: "Expiring today",
        className: "text-red-500 font-medium",
      };
    } else if (daysRemaining === 1) {
      return {
        message: "Expires tomorrow",
        className: "text-orange-500 font-medium",
      };
    } else if (daysRemaining <= 3) {
      return {
        message: `Expires in ${daysRemaining} days`,
        className: "text-orange-500",
      };
    } else {
      return {
        message: `Expires in ${daysRemaining} days`,
        className: "text-slate-500",
      };
    }
  };

  const truncateText = (text: string, maxLength = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handleDelete = async (file: FileResponse) => {
    if (!onDeleteFile) return;

    try {
      await onDeleteFile(file);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file", {
        description:
          error instanceof Error ? error.message : "Unexpected error occurred",
      });
    }
  };

  const handleDownload = (file: FileResponse) => {
    if (onDownload) {
      onDownload(file);
    }
  };

  const handleCopyText = (text: SharedText) => {
    if (onCopyText) {
      onCopyText(text);
    }

    navigator.clipboard
      .writeText(text.content)
      .then(() => {
        toast.success("Copied to clipboard", {
          description: "Text has been copied to your clipboard.",
        });
      })
      .catch(() => {
        toast.error("Failed to copy", {
          description: "Could not copy text to clipboard.",
        });
      });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    } else if (type.startsWith("video/")) {
      return <VideoIcon className="h-5 w-5 text-purple-500" />;
    } else if (type.startsWith("audio/")) {
      return <FileTextIcon className="h-5 w-5 text-pink-500" />;
    } else if (type.startsWith("text/")) {
      return <FileTextIcon className="h-5 w-5 text-green-500" />;
    } else if (type.includes("pdf")) {
      return <FileTextIcon className="h-5 w-5 text-red-500" />;
    } else {
      return <FileIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const hasSharedItems = files.length > 0 || (texts && texts.length > 0);

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl animate-fade-in">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700"
                  >
                    <LucideFileIcon className="h-3 w-3 mr-1" /> Shared Files
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {files.length} / 20
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {onRefresh && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onRefresh}
                    className="p-1 h-7 w-7 flex items-center justify-center"
                    title="Refresh files"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {files.length > 0 && onDeleteAllFiles && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-2 h-7 flex items-center justify-center gap-1"
                        title="Delete all files"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-xs text-destructive">
                          Delete All
                        </span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete all files?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. All shared files will be
                          permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onDeleteAllFiles}
                          className="bg-destructive hover:bg-destructive/90"
                          autoFocus
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
              {files.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No files shared yet
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="mr-3 text-slate-400 dark:text-slate-500">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>{formatSize(file.size)}</span>
                        <span className="mx-1.5">•</span>
                        <span>{formatDate(file.shared_at)}</span>
                      </div>
                      <div
                        className={cn(
                          "text-xs",
                          getExpirationMessage(file.shared_at).className,
                        )}
                      >
                        {getExpirationMessage(file.shared_at).message}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(file)}
                        className="p-1 h-7 w-7 flex items-center justify-center"
                        title="Download file"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {onDeleteFile && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(file)}
                          className="p-1 h-7 w-7 flex items-center justify-center"
                          title="Delete file"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileList;

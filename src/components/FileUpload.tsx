import React, { useCallback, useState, useRef } from "react";
import { toast } from "sonner";
import { File, Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  uploadFile,
  fetchSharedFiles,
  FileResponse,
} from "@/utils/networkUtils";

interface FileUploadProps {
  networkConnected: boolean;
  onFilesUploaded: (files: FileResponse[]) => void;
  privateSpaceKey?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  networkConnected,
  onFilesUploaded,
  privateSpaceKey,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [cancelUpload, setCancelUpload] = useState(false);
  const uploadRef = useRef<boolean>(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fileList = Array.from(e.dataTransfer.files);
        handleUpload(fileList);
      }
    },
    [networkConnected, privateSpaceKey],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const fileList = Array.from(e.target.files);
        handleUpload(fileList);
      }
    },
    [networkConnected, privateSpaceKey],
  );

  const handleUpload = async (fileList: File[]) => {
    if (!networkConnected) {
      toast.error("Not connected", {
        description:
          "Please connect to a network or enter a private space to share files.",
      });
      return;
    }

    // Preserve the original file selection order
    const originalOrderFiles = Array.from(fileList);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Check if any file exceeds 50MB size limit
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
      const oversizedFiles = fileList.filter(
        (file) => file.size > MAX_FILE_SIZE,
      );
      if (oversizedFiles.length > 0) {
        toast.error("File too large", {
          description: `Some files exceed the 50MB size limit. Maximum file size is 50MB.`,
        });
        setIsUploading(false);
        return;
      }

      // Check file count limit (20 files per network/space)
      const existingFiles = await fetchSharedFiles(privateSpaceKey);
      if (existingFiles.length >= 20) {
        toast.error("File limit reached", {
          description:
            "You've reached the maximum limit of 20 files. Please delete some files before uploading more.",
        });
        setIsUploading(false);
        return;
      }

      // Check if total files would exceed limit (50 is the maximum for batch upload)
      if (originalOrderFiles.length > 50) {
        toast.error("Too many files", {
          description: "You can only upload up to 50 files at once.",
        });
        setIsUploading(false);
        return;
      }

      // Deduplicate files while maintaining original selection order
      const seen = new Set();
      const uniqueFiles = originalOrderFiles.filter((file) => {
        const key = `${file.name}-${file.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Validate file count after deduplication
      if (uniqueFiles.length > 50) {
        toast.error("Too many files", {
          description:
            "You can only upload up to 50 files at once after removing duplicates.",
        });
        setIsUploading(false);
        return;
      }

      // Upload files sequentially to maintain order
      const uploadedFiles = [];
      let uploadedCount = 0;
      for (let i = 0; i < uniqueFiles.length; i++) {
        // Check if upload was cancelled
        if (uploadRef.current) {
          break;
        }

        const file = uniqueFiles[i];
        setUploadStatus(
          `Uploading ${i + 1}/${uniqueFiles.length}: ${file.name}`,
        );

        try {
          const fileData = await uploadFile(file, privateSpaceKey);
          uploadedFiles.push(fileData);
          uploadedCount++;
          setUploadProgress(((i + 1) / uniqueFiles.length) * 100);
        } catch (error) {
          if (uploadRef.current) {
            break;
          }
          throw error;
        }
      }

      if (uploadedFiles.length > 0) {
        if (!uploadRef.current) {
          toast.success("Upload complete", {
            description: `Successfully shared ${uploadedCount} file${uploadedCount > 1 ? "s" : ""} ${privateSpaceKey ? "in your private space" : "on your network"}.`,
          });
          // Only update the file list once after all files are uploaded
          const updatedFiles = await fetchSharedFiles(privateSpaceKey);
          onFilesUploaded(updatedFiles);
        } else {
          toast.info("Upload cancelled", {
            description: `Cancelled after uploading ${uploadedCount} of ${uniqueFiles.length} files`,
          });
          if (uploadedCount > 0) {
            // Update file list with all successfully uploaded files before cancellation
            const updatedFiles = await fetchSharedFiles(privateSpaceKey);
            onFilesUploaded(updatedFiles);
          }
        }
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Upload failed", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload files. Please try again.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
      setCancelUpload(false);
      uploadRef.current = false;
    }
  };

  const handleCancelUpload = () => {
    uploadRef.current = true;
    setCancelUpload(true);
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md animate-fade-in">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <Badge
            variant="outline"
            className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700"
          >
            <File className="h-3 w-3 mr-1" /> Share Files
          </Badge>
        </div>
        {isUploading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelUpload}
            disabled={cancelUpload}
            className="p-1 h-7 w-7 flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-2 mb-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs rounded">
        <p className="font-medium">File Limits:</p>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>Maximum size: 50MB per file</li>
          <li>Maximum files: 20 per network/space</li>
          <li>Files auto-delete after 2 days</li>
        </ul>
      </div>

      <label className="block w-full cursor-pointer">
        <input
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          disabled={!networkConnected || isUploading}
        />
        <div
          className={`border-2 border-dashed ${isDragging ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"} 
            rounded-md transition-colors mb-3 hover:border-primary hover:bg-primary/5 cursor-pointer`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center p-6">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium text-center mb-1">
                  {uploadStatus}
                </p>
                <div className="w-full max-w-xs mb-2">
                  <Progress value={uploadProgress} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(uploadProgress)}% complete
                </p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-center mb-2">
                  Drag and drop files here, or{" "}
                  <span className="text-primary hover:underline">browse</span>
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Files will be shared with devices{" "}
                  {privateSpaceKey
                    ? "in your private space"
                    : "on your network"}
                </p>
              </>
            )}
          </div>
        </div>
      </label>

      {!networkConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs p-2 rounded">
          Connect to a network or enter a private space to share files
        </div>
      )}
    </div>
  );
};

export default FileUpload;

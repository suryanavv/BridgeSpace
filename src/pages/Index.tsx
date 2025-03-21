import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import NetworkStatus from "@/components/NetworkStatus";
import FileUpload from "@/components/FileUpload";
import TextShare from "@/components/TextShare";
import FileList from "@/components/FileList";
import { toast } from "sonner";
import {
  fetchSharedFiles,
  fetchSharedTexts,
  getCachedNetworkPrefix,
} from "@/utils/networkUtils";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Types for shared items
interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  shared_at: string;
  network_prefix: string;
  private_space_key?: string;
}

interface SharedText {
  id: string;
  content: string;
  shared_at: string;
  network_prefix?: string;
  private_space_key?: string;
}

const Index: React.FC = () => {
  // Network state
  const [networkConnected, setNetworkConnected] = useState(false);
  const [networkPrefix, setNetworkPrefix] = useState("");
  const [clientIP, setClientIP] = useState("");

  // Private space state
  const [isPrivateSpace, setIsPrivateSpace] = useState(false);
  const [privateSpaceKey, setPrivateSpaceKey] = useState("");
  const [inputKey, setInputKey] = useState("");
  const [showPrivateSpaceModal, setShowPrivateSpaceModal] = useState(false);

  // Shared items state
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharedTexts, setSharedTexts] = useState<SharedText[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch shared items from database
  const fetchSharedItems = async () => {
    if (!networkConnected && !isPrivateSpace) {
      setSharedFiles([]);
      setSharedTexts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch files and texts in parallel
      const [files, texts] = await Promise.all([
        fetchSharedFiles(isPrivateSpace ? privateSpaceKey : undefined),
        fetchSharedTexts(isPrivateSpace ? privateSpaceKey : undefined),
      ]);

      setSharedFiles(files);
      setSharedTexts(texts);
    } catch (error) {
      console.error("Error fetching shared items:", error);
      toast.error("Failed to load shared items", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enter private space
  const enterPrivateSpace = () => {
    if (!inputKey) {
      toast.error("Please enter a secret key");
      return;
    }
    setIsPrivateSpace(true);
    setPrivateSpaceKey(inputKey);
    setNetworkConnected(false); // Disable network mode while in a private space
    setShowPrivateSpaceModal(false);
    fetchSharedItems();
    toast.success(`Entered private space: ${inputKey}`);
  };

  // Exit private space
  const exitPrivateSpace = () => {
    setIsPrivateSpace(false);
    setPrivateSpaceKey("");
    setInputKey("");
    fetchSharedItems();
    toast.success("Returned to network mode");
  };

  // Handle network status change
  const handleNetworkChange = (
    connected: boolean,
    prefix: string,
    ip: string,
  ) => {
    setNetworkConnected(connected);
    setNetworkPrefix(prefix);
    setClientIP(ip);

    // Fetch shared items when network status changes
    if (connected && prefix !== networkPrefix) {
      fetchSharedItems();
    } else if (!connected && !isPrivateSpace) {
      // Clear shared items when disconnected (if not in private space)
      setSharedFiles([]);
      setSharedTexts([]);
    }
  };

  // Handle file upload/share
  const handleFilesUploaded = (files: File[]) => {
    // Refresh the file list after uploading
    fetchSharedItems();
  };

  // Handle text share
  const handleTextShared = (text: string) => {
    // Refresh the text list after sharing
    fetchSharedItems();
  };

  // Handle file download
  const handleDownload = async (file: SharedFile) => {
    try {
      // Extract the file path from the URL
      const fileUrl = new URL(file.url);
      const filePath = fileUrl.pathname.split("/public/shared_files/")[1];

      if (!filePath) {
        throw new Error("Invalid file path");
      }

      // Download file using Supabase storage
      const { data, error } = await supabase.storage
        .from("shared_files")
        .download(filePath);

      if (error || !data) {
        throw error || new Error("Failed to download file");
      }

      // Create blob URL and trigger download
      const blob = new Blob([data], { type: file.type });
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success("Download started", {
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Download failed", {
        description: "Failed to download the file. Please try again.",
      });
    }
  };

  // Refresh shared items when component mounts or network/private space changes
  useEffect(() => {
    if (networkConnected || isPrivateSpace) {
      fetchSharedItems();
    }
  }, [networkConnected, networkPrefix, isPrivateSpace, privateSpaceKey]);

  // Refresh shared items periodically
  // Setup real-time updates with Supabase
  useEffect(() => {
    if (!networkConnected && !isPrivateSpace) return;

    const channel = supabase.channel("shared_items_changes");

    const subscription = channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shared_files",
          filter: isPrivateSpace 
            ? `private_space_key=eq.${privateSpaceKey}` 
            : `network_prefix=eq.${networkPrefix}`,
        },
        () => {
          // Refresh the file list when changes occur
          fetchSharedItems();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      channel.unsubscribe();
    };
  }, [networkConnected, networkPrefix, isPrivateSpace, privateSpaceKey]);

  const getStoragePathFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Handle different URL formats
      if (pathname.includes("/shared_files/")) {
        // Extract the path after 'shared_files/'
        const parts = pathname.split("/shared_files/");
        if (parts.length > 1) {
          return decodeURIComponent(parts[1]);
        }
      } else if (pathname.includes("/object/shared_files/")) {
        // Handle object storage format
        const parts = pathname.split("/object/shared_files/");
        if (parts.length > 1) {
          return decodeURIComponent(parts[1]);
        }
      }

      throw new Error("Could not extract storage path from URL");
    } catch (error) {
      console.error("Error extracting path from URL:", error);
      return "";
    }
  };

  const handleDeleteFile = async (file: SharedFile) => {
    if (!file || !file.url) {
      toast.error("Invalid file data");
      return;
    }

    try {
      // Extract the storage path
      const storagePath = getStoragePathFromUrl(file.url);

      if (!storagePath) {
        throw new Error("Could not determine storage path");
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("shared_files")
        .remove([storagePath]);

      if (storageError) {
        console.warn("Storage delete error:", storageError);
        // Continue anyway, as we want to remove from database
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("shared_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast.success("File deleted", {
        description: `${file.name} has been removed`,
      });

      // Refresh file list
      fetchSharedItems();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file", {
        description: "An error occurred while trying to delete the file",
      });
    }
  };

  const handleDeleteAllFiles = async () => {
    if (sharedFiles.length === 0) return;

    try {
      // Extract paths for all files
      const storagePaths = sharedFiles
        .map((file) => getStoragePathFromUrl(file.url))
        .filter(Boolean);

      // Delete all files from storage
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("shared_files")
          .remove(storagePaths as string[]);

        if (storageError) {
          console.warn("Storage delete error:", storageError);
          // Continue anyway, as we want to remove from database
        }
      }

      // Delete all files from database for this network prefix or private space
      const { error: dbError } = await supabase
        .from("shared_files")
        .delete()
        .eq(isPrivateSpace ? "private_space_key" : "network_prefix", isPrivateSpace ? privateSpaceKey : networkPrefix);

      if (dbError) throw dbError;

      toast.success("All files deleted", {
        description: "All files have been removed",
      });

      // Refresh file list
      fetchSharedItems();
    } catch (error) {
      console.error("Delete all error:", error);
      toast.error("Failed to delete files", {
        description: "An error occurred while trying to delete files",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onNetworkChange={handleNetworkChange} />
      
      <main className="container max-w-5xl mx-auto px-4 mt-4 pb-20">
        <div className="w-full mb-6">
          <NetworkStatus 
            onNetworkChange={handleNetworkChange}
            onRefresh={fetchSharedItems}
            isPrivateSpace={isPrivateSpace}
            privateSpaceKey={privateSpaceKey}
          />
          
          <div className="flex justify-end mt-3">
            {isPrivateSpace ? (
              <Button 
                onClick={exitPrivateSpace} 
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Exit Private Space
              </Button>
            ) : (
              <Button 
                onClick={() => setShowPrivateSpaceModal(true)} 
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Create/Join Private Space
              </Button>
            )}
          </div>
        </div>

        {showPrivateSpaceModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-lg font-medium mb-4">Enter Private Space Key</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Enter a secret key to create or join a private space. Anyone with this key will be able to access shared files and texts.
              </p>
              <Input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="e.g., mySecretSpace123"
                className="w-full mb-4"
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPrivateSpaceModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={enterPrivateSpace}>
                  Enter
                </Button>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="file" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2 bg-slate-200 dark:bg-slate-700 p-1 rounded-md">
            <TabsTrigger value="file" className="rounded-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
              <Upload className="h-4 w-4 mr-2" /> File
            </TabsTrigger>
            <TabsTrigger value="text" className="rounded-sm data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary">
              <FileText className="h-4 w-4 mr-2" /> Text
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="mt-4 space-y-6">
            <FileUpload
              networkConnected={networkConnected || isPrivateSpace}
              onFilesUploaded={handleFilesUploaded}
              privateSpaceKey={isPrivateSpace ? privateSpaceKey : undefined}
            />
            <FileList
              files={sharedFiles}
              onDownload={handleDownload}
              onDeleteFile={handleDeleteFile}
              onDeleteAllFiles={handleDeleteAllFiles}
              isLoading={isLoading}
            />
          </TabsContent>
          <TabsContent value="text" className="mt-4">
            <TextShare
              networkConnected={networkConnected || isPrivateSpace}
              onTextShared={handleTextShared}
              privateSpaceKey={isPrivateSpace ? privateSpaceKey : undefined}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;

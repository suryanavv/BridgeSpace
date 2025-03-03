
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import NetworkStatus from '@/components/NetworkStatus';
import FileUpload from '@/components/FileUpload';
import TextShare from '@/components/TextShare';
import FileList from '@/components/FileList';
import { toast } from 'sonner';
import { fetchSharedFiles, fetchSharedTexts } from '@/utils/networkUtils';
import { supabase } from '@/integrations/supabase/client';  // Add this line
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText } from "lucide-react";

// Types for shared items
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

const Index: React.FC = () => {
  // Network state
  const [networkConnected, setNetworkConnected] = useState(false);
  const [networkPrefix, setNetworkPrefix] = useState('');
  const [clientIP, setClientIP] = useState('');
  
  // Shared items state
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharedTexts, setSharedTexts] = useState<SharedText[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch shared items from database
  const fetchSharedItems = async () => {
    if (!networkConnected) {
      setSharedFiles([]);
      setSharedTexts([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Fetch files and texts in parallel
      const [files, texts] = await Promise.all([
        fetchSharedFiles(),
        fetchSharedTexts()
      ]);
      
      setSharedFiles(files);
      setSharedTexts(texts);
    } catch (error) {
      console.error('Error fetching shared items:', error);
      toast.error('Failed to load shared items', {
        description: 'Please check your network connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle network status change
  const handleNetworkChange = (connected: boolean, prefix: string, ip: string) => {
    setNetworkConnected(connected);
    setNetworkPrefix(prefix);
    setClientIP(ip);
    
    // Fetch shared items when network status changes
    if (connected && prefix !== networkPrefix) {
      fetchSharedItems();
    } else if (!connected) {
      // Clear shared items when disconnected
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
      const filePath = fileUrl.pathname.split('/public/shared_files/')[1];
      
      if (!filePath) {
        throw new Error('Invalid file path');
      }
    
      // Download file using Supabase storage
      const { data, error } = await supabase
        .storage
        .from('shared_files')
        .download(filePath);
      
      if (error || !data) {
        throw error || new Error('Failed to download file');
      }
    
      // Create blob URL and trigger download
      const blob = new Blob([data], { type: file.type });
      const objectUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      toast.success('Download started', {
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed', {
        description: 'Failed to download the file. Please try again.',
      });
    }
  };

  // Refresh shared items when component mounts or network changes
  useEffect(() => {
    if (networkConnected) {
      fetchSharedItems();
    }
  }, [networkConnected, networkPrefix]);

  // Refresh shared items periodically
  // Update the useEffect for real-time updates
  useEffect(() => {
    if (!networkConnected || !networkPrefix) return;
    
    const channel = supabase.channel('shared_files_changes');
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_files',
          filter: `network_prefix=eq.${networkPrefix}`
        },
        () => {
          // Refresh the file list when changes occur
          fetchSharedItems();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
      channel.unsubscribe();
    };
  }, [networkConnected, networkPrefix]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="col-span-1">
            <NetworkStatus 
              onNetworkChange={handleNetworkChange}
              onRefresh={fetchSharedItems}
            />
          </div>
          
          <div className="col-span-1">
            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  File
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Text
                </TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="mt-4 space-y-6">
                <FileUpload 
                  networkConnected={networkConnected}
                  onFilesUploaded={handleFilesUploaded}
                />
                <FileList
                  files={sharedFiles}
                  onDownload={handleDownload}
                  isLoading={isLoading}
                />
              </TabsContent>
              <TabsContent value="text" className="mt-4">
                <TextShare
                  networkConnected={networkConnected}
                  onTextShared={handleTextShared}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            {networkConnected ? (
              <>Connected to network {networkPrefix}.* as {clientIP}</>
            ) : (
              'Not connected to any network'
            )}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;

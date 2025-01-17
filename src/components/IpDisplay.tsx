import React, { useState, useEffect } from 'react';
import { NetworkIcon, Menu, Trash2, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from '@/utils/supabase';
import { NetworkUtils } from '@/utils/network';
import { cn } from "@/lib/utils";

export const IpDisplay = () => {
  const [ip, setIp] = useState<string>('Loading...');
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setIp(data.ip);
      } catch (error) {
        console.error('Error fetching IP:', error);
        setIp('Failed to load IP');
      }
    };

    fetchIp();
  }, []);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      const currentNetworkId = await NetworkUtils.detectNetwork();

      if (!currentNetworkId) {
        toast.error("Network not identified");
        return;
      }

      // First, delete all files from storage
      const { data: files, error: filesError } = await supabase
        .from('shared_files')
        .select('id')
        .eq('network_id', currentNetworkId);

      if (filesError) throw filesError;

      // Delete files from storage bucket
      if (files && files.length > 0) {
        const fileIds = files.map(file => `${file.id}`);
        const { error: storageError } = await supabase.storage
          .from('shared-files')
          .remove(fileIds);

        if (storageError) throw storageError;
      }

      // Delete file records from database
      const { error: deleteFilesError } = await supabase
        .from('shared_files')
        .delete()
        .eq('network_id', currentNetworkId);

      if (deleteFilesError) throw deleteFilesError;

      // First update shared text to empty
      const { error: updateTextError } = await supabase
        .from('shared_text')
        .update({ content: '' })
        .eq('network_id', currentNetworkId);

      if (updateTextError) throw updateTextError;

      // Then delete the text entry
      const { error: deleteTextError } = await supabase
        .from('shared_text')
        .delete()
        .eq('network_id', currentNetworkId);

      if (deleteTextError) throw deleteTextError;

      // Delete network entry last
      const { error: deleteNetworkError } = await supabase
        .from('networks')
        .delete()
        .eq('network_id', currentNetworkId);

      if (deleteNetworkError) throw deleteNetworkError;

      toast.success('All data cleared successfully');

      // Wait a bit before reloading to ensure all operations complete
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error('Failed to reset data');
    } finally {
      setIsResetting(false);
      setIsOpen(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      setIsRefreshing(true);
      
      let currentNetworkId = await NetworkUtils.detectNetwork();
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!currentNetworkId && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentNetworkId = await NetworkUtils.detectNetwork();
        retryCount++;
      }

      if (!currentNetworkId) {
        throw new Error('Failed to detect network after multiple attempts');
      }

      // Fetch files and text content
      const [filesResponse, textResponse] = await Promise.all([
        supabase
          .from('shared_files')
          .select('*')
          .eq('network_id', currentNetworkId)
          .order('created_at', { ascending: false }),
        supabase
          .from('shared_text')
          .select('*')
          .eq('network_id', currentNetworkId)
          .single()
      ]);

      if (filesResponse.error) {
        throw filesResponse.error;
      }

      if (textResponse.error && textResponse.error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is okay
        throw textResponse.error;
      }

      toast.success('Content refreshed successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing content:', error);
      toast.error('Failed to refresh content');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handleRefreshAll}
        disabled={isRefreshing}
        className="bg-white/95 backdrop-blur-sm hover:bg-white/100"
      >
        <RefreshCw 
          className={cn(
            "h-5 w-5",
            isRefreshing && "animate-spin"
          )}
        />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-white/95 backdrop-blur-sm hover:bg-white/100">
            <Menu className="h-5 w-5"/>
          </Button>
        </SheetTrigger>
        <SheetContent 
          className="w-[300px] sm:w-[400px] pt-6 [&_button[aria-label='Close']]:hidden"
        >
          <Tabs defaultValue="network" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="network">Network Info</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="network" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <NetworkIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">IP Address:</span>
                  <span>{ip}</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Reset Data</h4>
                  <p className="text-sm text-gray-500">
                    Clear all data associated with your network. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    handleReset();
                    setIsOpen(false);
                  }}
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⟳</span> Resetting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" /> Reset All Data
                    </span>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}; 